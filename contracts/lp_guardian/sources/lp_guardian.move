/// LP Guardian — non-custodial portfolio capability layer (Sui Overflow 2026).
///
/// Design intent (see brief §6.1, §7.3):
/// - A `Portfolio` is a shared object owned (logically) by one address. It locks a real
///   `Balance<SUI>` vault and holds `Position` children (LP metadata) via dynamic object fields.
/// - A `StrategistCap` is a revocable capability minted by the owner for an agent address. It lets
///   the agent `rebalance` (within a whitelist + slippage bound) and `mint_health_report` — but the
///   module exposes NO function that can move funds to anyone other than `portfolio.owner`.
/// - Non-custody is structural, not a promise: `rebalance` (the agent path) never touches the vault,
///   and `withdraw` (the only coin-exit path) rejects non-owners and hard-codes the recipient to the
///   owner. Proven by the "agent cannot withdraw to self" unit test.
module lp_guardian::lp_guardian;

use std::string::String;
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::dynamic_object_field as dof;
use sui::event;
use sui::sui::SUI;

// ===== Error codes =====
const ENotOwner: u64 = 0;
const ECapPortfolioMismatch: u64 = 1;
const ECapRevoked: u64 = 2;
const ECapWrongAgent: u64 = 3;
const ECapExpired: u64 = 4;
const EPoolNotWhitelisted: u64 = 5;
const ESlippageExceeded: u64 = 6;
const EInsufficientVault: u64 = 7;

// ===== Risk level encoding (matches FE "green|amber|red") =====
const RISK_GREEN: u8 = 0;
const RISK_AMBER: u8 = 1;
const RISK_RED: u8 = 2;

// ===== Objects =====

/// Shared object. Locks a real SUI vault and parents Position children.
public struct Portfolio has key {
    id: UID,
    /// The only address funds can ever flow back to.
    owner: address,
    /// Real on-chain value under management.
    vault: Balance<SUI>,
    /// Pool object ids the agent is allowed to rebalance INTO.
    whitelist: vector<ID>,
    /// Upper bound (basis points) the agent must respect on any rebalance.
    max_slippage_bps: u64,
    /// Monotonic nonce. Bumped on revoke so every previously-minted cap dies at once.
    cap_version: u64,
    /// Currently authorized agent address (None when revoked / never set).
    active_strategist: Option<address>,
    position_count: u64,
    health_score: u8,
    risk_level: u8,
}

/// LP position metadata. Stored as a dynamic object field child of a Portfolio.
public struct Position has key, store {
    id: UID,
    portfolio_id: ID,
    /// 0 = cetus, 1 = turbos, 2 = deepbook.
    protocol: u8,
    pool_id: ID,
    token_x: String,
    token_y: String,
    liquidity: u128,
    tick_lower: u32,
    tick_upper: u32,
    value_usd: u64,
}

/// Revocable capability. Held by the agent; validated against the Portfolio on every privileged call.
public struct StrategistCap has key, store {
    id: UID,
    portfolio_id: ID,
    agent_address: address,
    expires_at_epoch: u64,
    cap_version: u64,
}

/// Immutable (frozen) audit record minted by the strategist.
public struct HealthReport has key {
    id: UID,
    portfolio_id: ID,
    score: u8,
    risk_level: u8,
    insights: String,
    allocation: String,
    confidence: u8,
    epoch: u64,
}

/// Lightweight shared registry entry referencing a DeepBook pool (off-chain depth/exec lives elsewhere).
public struct DeepBookPoolRef has key {
    id: UID,
    pool_id: ID,
    base: String,
    quote: String,
}

// ===== Events =====

public struct PortfolioCreated has copy, drop { portfolio_id: ID, owner: address }
public struct PositionAdded has copy, drop { portfolio_id: ID, position_id: ID, protocol: u8 }
public struct StrategistAuthorized has copy, drop {
    portfolio_id: ID,
    agent_address: address,
    expires_at_epoch: u64,
    cap_version: u64,
}
public struct Rebalanced has copy, drop {
    portfolio_id: ID,
    agent_address: address,
    slippage_bps: u64,
    target_count: u64,
}
public struct Withdrawn has copy, drop { portfolio_id: ID, owner: address, amount: u64 }
public struct CapRevoked has copy, drop { portfolio_id: ID, new_cap_version: u64 }
public struct HealthUpdated has copy, drop { portfolio_id: ID, score: u8, risk_level: u8, epoch: u64 }
public struct HealthReportMinted has copy, drop { report_id: ID, portfolio_id: ID, epoch: u64 }

// ===== Internal helpers =====

fun assert_owner(portfolio: &Portfolio, ctx: &TxContext) {
    assert!(portfolio.owner == ctx.sender(), ENotOwner);
}

/// Validate a capability against the portfolio: matching portfolio, live version, correct agent, unexpired.
fun assert_valid_cap(portfolio: &Portfolio, cap: &StrategistCap, ctx: &TxContext) {
    assert!(cap.portfolio_id == object::id(portfolio), ECapPortfolioMismatch);
    assert!(cap.cap_version == portfolio.cap_version, ECapRevoked);
    assert!(cap.agent_address == ctx.sender(), ECapWrongAgent);
    assert!(ctx.epoch() <= cap.expires_at_epoch, ECapExpired);
}

// ===== Entry / public functions (signatures frozen per brief §7.3) =====

/// Create an empty portfolio and share it. Caller becomes owner.
public fun create_portfolio(
    whitelist: vector<ID>,
    max_slippage_bps: u64,
    ctx: &mut TxContext,
): ID {
    let portfolio = Portfolio {
        id: object::new(ctx),
        owner: ctx.sender(),
        vault: balance::zero<SUI>(),
        whitelist,
        max_slippage_bps,
        cap_version: 0,
        active_strategist: option::none(),
        position_count: 0,
        health_score: 0,
        risk_level: RISK_GREEN,
    };
    let portfolio_id = object::id(&portfolio);
    event::emit(PortfolioCreated { portfolio_id, owner: portfolio.owner });
    transfer::share_object(portfolio);
    portfolio_id
}

/// Deposit SUI into the portfolio vault (owner-only). Used to fund the managed treasury.
public fun deposit(portfolio: &mut Portfolio, coin: Coin<SUI>, ctx: &TxContext) {
    assert_owner(portfolio, ctx);
    balance::join(&mut portfolio.vault, coin::into_balance(coin));
}

/// Add an LP position (owner-only) as a dynamic object field child of the portfolio.
public fun add_position(
    portfolio: &mut Portfolio,
    protocol: u8,
    pool_id: ID,
    token_x: String,
    token_y: String,
    liquidity: u128,
    tick_lower: u32,
    tick_upper: u32,
    value_usd: u64,
    ctx: &mut TxContext,
): ID {
    assert_owner(portfolio, ctx);
    let position = Position {
        id: object::new(ctx),
        portfolio_id: object::id(portfolio),
        protocol,
        pool_id,
        token_x,
        token_y,
        liquidity,
        tick_lower,
        tick_upper,
        value_usd,
    };
    let position_id = object::id(&position);
    let idx = portfolio.position_count;
    portfolio.position_count = idx + 1;
    dof::add(&mut portfolio.id, idx, position);
    event::emit(PositionAdded { portfolio_id: object::id(portfolio), position_id, protocol });
    position_id
}

/// Mint a revocable StrategistCap for `agent_address` (owner-only). Caller transfers it to the agent.
public fun authorize_strategist(
    portfolio: &mut Portfolio,
    agent_address: address,
    expires_at_epoch: u64,
    ctx: &mut TxContext,
): StrategistCap {
    assert_owner(portfolio, ctx);
    portfolio.active_strategist = option::some(agent_address);
    let cap = StrategistCap {
        id: object::new(ctx),
        portfolio_id: object::id(portfolio),
        agent_address,
        expires_at_epoch,
        cap_version: portfolio.cap_version,
    };
    event::emit(StrategistAuthorized {
        portfolio_id: object::id(portfolio),
        agent_address,
        expires_at_epoch,
        cap_version: portfolio.cap_version,
    });
    cap
}

/// Agent-driven rebalance. Validates capability, enforces pool whitelist + slippage bound, and
/// updates position metadata. NO recipient parameter; NO coin leaves the vault.
public fun rebalance(
    portfolio: &mut Portfolio,
    cap: &StrategistCap,
    target_pools: vector<ID>,
    new_value_usd: vector<u64>,
    slippage_bps: u64,
    ctx: &mut TxContext,
) {
    assert_valid_cap(portfolio, cap, ctx);
    assert!(slippage_bps <= portfolio.max_slippage_bps, ESlippageExceeded);

    // Every target pool must be whitelisted.
    let n = target_pools.length();
    let mut i = 0;
    while (i < n) {
        assert!(portfolio.whitelist.contains(&target_pools[i]), EPoolNotWhitelisted);
        i = i + 1;
    };

    // Apply the new per-position valuations the agent computed off-chain (metadata only).
    let m = new_value_usd.length();
    let mut j = 0;
    while (j < m && j < portfolio.position_count) {
        let pos: &mut Position = dof::borrow_mut(&mut portfolio.id, j);
        pos.value_usd = new_value_usd[j];
        j = j + 1;
    };

    event::emit(Rebalanced {
        portfolio_id: object::id(portfolio),
        agent_address: cap.agent_address,
        slippage_bps,
        target_count: n,
    });
}

/// The ONLY coin-exit path. Owner-only; recipient hard-coded to `portfolio.owner`.
public fun withdraw(portfolio: &mut Portfolio, amount: u64, ctx: &mut TxContext) {
    assert_owner(portfolio, ctx);
    assert!(balance::value(&portfolio.vault) >= amount, EInsufficientVault);
    let coin = coin::take(&mut portfolio.vault, amount, ctx);
    let owner = portfolio.owner;
    transfer::public_transfer(coin, owner);
    event::emit(Withdrawn { portfolio_id: object::id(portfolio), owner, amount });
}

/// Revoke all outstanding capabilities by bumping the version nonce (owner-only).
public fun revoke_cap(portfolio: &mut Portfolio, ctx: &TxContext) {
    assert_owner(portfolio, ctx);
    portfolio.cap_version = portfolio.cap_version + 1;
    portfolio.active_strategist = option::none();
    event::emit(CapRevoked {
        portfolio_id: object::id(portfolio),
        new_cap_version: portfolio.cap_version,
    });
}

/// Update health + mint an immutable (frozen) HealthReport. Requires a valid capability.
public fun mint_health_report(
    portfolio: &mut Portfolio,
    cap: &StrategistCap,
    score: u8,
    risk_level: u8,
    insights: String,
    allocation: String,
    confidence: u8,
    ctx: &mut TxContext,
): ID {
    assert_valid_cap(portfolio, cap, ctx);
    portfolio.health_score = score;
    portfolio.risk_level = risk_level;
    let report = HealthReport {
        id: object::new(ctx),
        portfolio_id: object::id(portfolio),
        score,
        risk_level,
        insights,
        allocation,
        confidence,
        epoch: ctx.epoch(),
    };
    let report_id = object::id(&report);
    event::emit(HealthUpdated {
        portfolio_id: object::id(portfolio),
        score,
        risk_level,
        epoch: ctx.epoch(),
    });
    event::emit(HealthReportMinted {
        report_id,
        portfolio_id: object::id(portfolio),
        epoch: ctx.epoch(),
    });
    transfer::freeze_object(report);
    report_id
}

/// Register a DeepBook pool reference as a shared object.
public fun register_deepbook_pool(
    pool_id: ID,
    base: String,
    quote: String,
    ctx: &mut TxContext,
): ID {
    let pool_ref = DeepBookPoolRef { id: object::new(ctx), pool_id, base, quote };
    let ref_id = object::id(&pool_ref);
    transfer::share_object(pool_ref);
    ref_id
}

// ===== Getters =====

public fun owner(portfolio: &Portfolio): address { portfolio.owner }
public fun vault_value(portfolio: &Portfolio): u64 { balance::value(&portfolio.vault) }
public fun whitelist(portfolio: &Portfolio): vector<ID> { portfolio.whitelist }
public fun max_slippage_bps(portfolio: &Portfolio): u64 { portfolio.max_slippage_bps }
public fun cap_version(portfolio: &Portfolio): u64 { portfolio.cap_version }
public fun active_strategist(portfolio: &Portfolio): Option<address> { portfolio.active_strategist }
public fun position_count(portfolio: &Portfolio): u64 { portfolio.position_count }
public fun health_score(portfolio: &Portfolio): u8 { portfolio.health_score }
public fun risk_level(portfolio: &Portfolio): u8 { portfolio.risk_level }

public fun cap_agent(cap: &StrategistCap): address { cap.agent_address }
public fun cap_portfolio_id(cap: &StrategistCap): ID { cap.portfolio_id }
public fun cap_expires_at(cap: &StrategistCap): u64 { cap.expires_at_epoch }

public fun report_score(report: &HealthReport): u8 { report.score }
public fun report_risk_level(report: &HealthReport): u8 { report.risk_level }
public fun report_portfolio_id(report: &HealthReport): ID { report.portfolio_id }

public fun position_value_usd(portfolio: &Portfolio, idx: u64): u64 {
    let pos: &Position = dof::borrow(&portfolio.id, idx);
    pos.value_usd
}

// Risk-level constant accessors (for tests / external callers).
public fun risk_green(): u8 { RISK_GREEN }
public fun risk_amber(): u8 { RISK_AMBER }
public fun risk_red(): u8 { RISK_RED }
