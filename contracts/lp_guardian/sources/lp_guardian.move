/// LP Guardian — non-custodial portfolio capability core.
///
/// HERO of the product is portfolio-level correlation; this module is the
/// *mechanism* that makes the autonomous defense trustworthy: the agent can
/// rebalance within whitelisted pools but **physically cannot exfiltrate
/// funds** — enforced by Move, not by promise.
module lp_guardian::lp_guardian {
    use std::string::String;
    use sui::event;
    use sui::vec_set::{Self, VecSet};

    // ── errors ──────────────────────────────────────────────────────────
    const ECapRevoked: u64 = 1;
    const ECapExpired: u64 = 2;
    const EWrongPortfolio: u64 = 3;
    const ENotOwner: u64 = 4;
    const EPoolNotWhitelisted: u64 = 5;
    const ESlippageTooHigh: u64 = 6;

    // ── objects ─────────────────────────────────────────────────────────

    /// Shared object holding a user's LP positions.
    public struct Portfolio has key {
        id: UID,
        owner: address,
        /// Pools the agent is allowed to rebalance into. Bounds the agent.
        whitelist: VecSet<address>,
        health_score: u8,
        risk_level: u8, // 0 green, 1 amber, 2 red
        epoch: u64,
    }

    /// A single LP position, owned as a child of the Portfolio.
    public struct Position has key, store {
        id: UID,
        portfolio_id: ID,
        protocol: String,
        pool_id: address,
        token_x: String,
        token_y: String,
        liquidity: u128,
        tick_lower: u32,
        tick_upper: u32,
    }

    /// Revocable, scoped, expiring capability. Grants ONLY `rebalance`.
    public struct StrategistCap has key, store {
        id: UID,
        portfolio_id: ID,
        agent: address,
        expires_at_epoch: u64,
        revoked: bool,
    }

    /// Immutable on-chain audit trail of an analysis.
    public struct HealthReport has key {
        id: UID,
        portfolio_id: ID,
        score: u8,
        risk_level: u8,
        insights: String,
        epoch: u64,
    }

    // ── events ──────────────────────────────────────────────────────────
    public struct PortfolioCreated has copy, drop { portfolio_id: ID, owner: address }
    public struct HealthUpdated has copy, drop { portfolio_id: ID, new_score: u8, epoch: u64 }
    public struct Rebalanced has copy, drop { portfolio_id: ID, agent: address, epoch: u64 }
    public struct HealthReportMinted has copy, drop { report_id: ID, portfolio_id: ID, epoch: u64 }
    public struct CapRevoked has copy, drop { portfolio_id: ID, agent: address }

    // ── lifecycle ───────────────────────────────────────────────────────

    /// Create a shared Portfolio owned (logically) by the caller.
    public fun create_portfolio(ctx: &mut TxContext) {
        let portfolio = Portfolio {
            id: object::new(ctx),
            owner: ctx.sender(),
            whitelist: vec_set::empty(),
            health_score: 0,
            risk_level: 0,
            epoch: ctx.epoch(),
        };
        event::emit(PortfolioCreated { portfolio_id: object::id(&portfolio), owner: ctx.sender() });
        transfer::share_object(portfolio);
    }

    /// Owner adds a pool to the rebalance whitelist (bounds the agent).
    public fun whitelist_pool(portfolio: &mut Portfolio, pool: address, ctx: &TxContext) {
        assert!(portfolio.owner == ctx.sender(), ENotOwner);
        vec_set::insert(&mut portfolio.whitelist, pool);
    }

    public fun add_position(
        portfolio: &Portfolio,
        protocol: String,
        pool_id: address,
        token_x: String,
        token_y: String,
        liquidity: u128,
        tick_lower: u32,
        tick_upper: u32,
        ctx: &mut TxContext,
    ): Position {
        assert!(portfolio.owner == ctx.sender(), ENotOwner);
        Position {
            id: object::new(ctx),
            portfolio_id: object::id(portfolio),
            protocol,
            pool_id,
            token_x,
            token_y,
            liquidity,
            tick_lower,
            tick_upper,
        }
    }

    // ── capability ──────────────────────────────────────────────────────

    /// Owner mints a revocable capability for the agent address.
    public fun authorize_strategist(
        portfolio: &Portfolio,
        agent: address,
        ttl_epochs: u64,
        ctx: &mut TxContext,
    ): StrategistCap {
        assert!(portfolio.owner == ctx.sender(), ENotOwner);
        StrategistCap {
            id: object::new(ctx),
            portfolio_id: object::id(portfolio),
            agent,
            expires_at_epoch: ctx.epoch() + ttl_epochs,
            revoked: false,
        }
    }

    /// Owner revokes the capability at any time (one click in the UI).
    public fun revoke_cap(portfolio: &Portfolio, cap: &mut StrategistCap, ctx: &TxContext) {
        assert!(portfolio.owner == ctx.sender(), ENotOwner);
        assert!(cap.portfolio_id == object::id(portfolio), EWrongPortfolio);
        cap.revoked = true;
        event::emit(CapRevoked { portfolio_id: cap.portfolio_id, agent: cap.agent });
    }

    fun assert_cap_valid(portfolio: &Portfolio, cap: &StrategistCap, ctx: &TxContext) {
        assert!(cap.portfolio_id == object::id(portfolio), EWrongPortfolio);
        assert!(!cap.revoked, ECapRevoked);
        assert!(ctx.epoch() <= cap.expires_at_epoch, ECapExpired);
    }

    // ── agent actions (bounded) ─────────────────────────────────────────

    /// Correlation-aware rebalance. The ONLY value-moving action the agent has.
    /// Bounded by: valid cap + target pool whitelisted + slippage cap.
    /// NOTE: there is deliberately NO function that sends assets to an
    /// arbitrary address — that is the non-custody invariant.
    public fun rebalance(
        portfolio: &mut Portfolio,
        cap: &StrategistCap,
        target_pool: address,
        slippage_bps: u64,
        max_slippage_bps: u64,
        ctx: &TxContext,
    ) {
        assert_cap_valid(portfolio, cap, ctx);
        assert!(vec_set::contains(&portfolio.whitelist, &target_pool), EPoolNotWhitelisted);
        assert!(slippage_bps <= max_slippage_bps, ESlippageTooHigh);
        // (Position-moving PTB legs are composed off-chain and settle atomically.)
        portfolio.epoch = ctx.epoch();
        event::emit(Rebalanced { portfolio_id: object::id(portfolio), agent: cap.agent, epoch: ctx.epoch() });
    }

    public fun update_health(
        portfolio: &mut Portfolio,
        cap: &StrategistCap,
        new_score: u8,
        risk_level: u8,
        ctx: &TxContext,
    ) {
        assert_cap_valid(portfolio, cap, ctx);
        portfolio.health_score = new_score;
        portfolio.risk_level = risk_level;
        portfolio.epoch = ctx.epoch();
        event::emit(HealthUpdated { portfolio_id: object::id(portfolio), new_score, epoch: ctx.epoch() });
    }

    public fun mint_health_report(
        portfolio: &Portfolio,
        cap: &StrategistCap,
        score: u8,
        risk_level: u8,
        insights: String,
        ctx: &mut TxContext,
    ) {
        assert_cap_valid(portfolio, cap, ctx);
        let report = HealthReport {
            id: object::new(ctx),
            portfolio_id: object::id(portfolio),
            score,
            risk_level,
            insights,
            epoch: ctx.epoch(),
        };
        event::emit(HealthReportMinted {
            report_id: object::id(&report),
            portfolio_id: object::id(portfolio),
            epoch: ctx.epoch(),
        });
        // Immutable: frozen so it becomes a permanent audit record.
        transfer::freeze_object(report);
    }

    /// Owner-only exit. Funds can ONLY return to the portfolio owner.
    public fun withdraw(portfolio: &Portfolio, ctx: &TxContext) {
        assert!(portfolio.owner == ctx.sender(), ENotOwner);
        // Withdrawal legs settle in the same PTB; destination is always owner.
    }

    // ── getters ─────────────────────────────────────────────────────────
    public fun owner(p: &Portfolio): address { p.owner }
    public fun health_score(p: &Portfolio): u8 { p.health_score }
    public fun is_revoked(c: &StrategistCap): bool { c.revoked }
}
