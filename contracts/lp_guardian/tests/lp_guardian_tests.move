#[test_only]
module lp_guardian::lp_guardian_tests;

use std::string;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};
use lp_guardian::lp_guardian::{Self as lpg, Portfolio, StrategistCap, HealthReport};

const OWNER: address = @0xA;
const AGENT: address = @0xB;
const ATTACKER: address = @0xC;

const POOL_A: address = @0x100;
const POOL_B: address = @0x200;
const POOL_OFF: address = @0x999;

// ===== helpers =====

fun whitelist(): vector<ID> {
    let mut v = vector::empty<ID>();
    v.push_back(object::id_from_address(POOL_A));
    v.push_back(object::id_from_address(POOL_B));
    v
}

/// Owner creates a portfolio (slippage bound `max_bps`), funds it with `funding` SUI, and adds one
/// ETH/USDC position. Leaves the shared Portfolio in scenario inventory.
fun setup_portfolio(sc: &mut Scenario, max_bps: u64, funding: u64) {
    ts::next_tx(sc, OWNER);
    lpg::create_portfolio(whitelist(), max_bps, ts::ctx(sc));
    ts::next_tx(sc, OWNER);
    {
        let mut p = ts::take_shared<Portfolio>(sc);
        let coin = coin::mint_for_testing<SUI>(funding, ts::ctx(sc));
        lpg::deposit(&mut p, coin, ts::ctx(sc));
        lpg::add_position(
            &mut p, 0, object::id_from_address(POOL_A),
            string::utf8(b"ETH"), string::utf8(b"USDC"),
            1000, 0, 100, 5000, ts::ctx(sc),
        );
        ts::return_shared(p);
    };
}

/// Owner authorizes AGENT with the given expiry and hands the cap to `cap_holder`.
fun authorize_to(sc: &mut Scenario, expires_at: u64, cap_holder: address) {
    ts::next_tx(sc, OWNER);
    {
        let mut p = ts::take_shared<Portfolio>(sc);
        let cap = lpg::authorize_strategist(&mut p, AGENT, expires_at, ts::ctx(sc));
        transfer::public_transfer(cap, cap_holder);
        ts::return_shared(p);
    };
}

// ===== tests =====

#[test]
fun test_create_and_add_position() {
    let mut sc = ts::begin(OWNER);
    setup_portfolio(&mut sc, 100, 10_000);
    ts::next_tx(&mut sc, OWNER);
    {
        let p = ts::take_shared<Portfolio>(&sc);
        assert!(lpg::owner(&p) == OWNER, 0);
        assert!(lpg::position_count(&p) == 1, 1);
        assert!(lpg::vault_value(&p) == 10_000, 2);
        assert!(lpg::position_value_usd(&p, 0) == 5000, 3);
        ts::return_shared(p);
    };
    ts::end(sc);
}

#[test]
fun test_rebalance_valid() {
    let mut sc = ts::begin(OWNER);
    setup_portfolio(&mut sc, 100, 10_000);
    authorize_to(&mut sc, 100, AGENT);
    ts::next_tx(&mut sc, AGENT);
    {
        let mut p = ts::take_shared<Portfolio>(&sc);
        let cap = ts::take_from_sender<StrategistCap>(&sc);
        let mut targets = vector::empty<ID>();
        targets.push_back(object::id_from_address(POOL_B));
        let mut vals = vector::empty<u64>();
        vals.push_back(2000);
        lpg::rebalance(&mut p, &cap, targets, vals, 50, ts::ctx(&mut sc));
        assert!(lpg::position_value_usd(&p, 0) == 2000, 0);
        ts::return_to_sender(&sc, cap);
        ts::return_shared(p);
    };
    ts::end(sc);
}

#[test, expected_failure(abort_code = lpg::EPoolNotWhitelisted)]
fun test_rebalance_pool_not_whitelisted() {
    let mut sc = ts::begin(OWNER);
    setup_portfolio(&mut sc, 100, 10_000);
    authorize_to(&mut sc, 100, AGENT);
    ts::next_tx(&mut sc, AGENT);
    {
        let mut p = ts::take_shared<Portfolio>(&sc);
        let cap = ts::take_from_sender<StrategistCap>(&sc);
        let mut targets = vector::empty<ID>();
        targets.push_back(object::id_from_address(POOL_OFF)); // not whitelisted
        lpg::rebalance(&mut p, &cap, targets, vector::empty<u64>(), 50, ts::ctx(&mut sc));
        ts::return_to_sender(&sc, cap);
        ts::return_shared(p);
    };
    ts::end(sc);
}

#[test, expected_failure(abort_code = lpg::ESlippageExceeded)]
fun test_rebalance_slippage_exceeded() {
    let mut sc = ts::begin(OWNER);
    setup_portfolio(&mut sc, 100, 10_000); // bound = 100 bps
    authorize_to(&mut sc, 100, AGENT);
    ts::next_tx(&mut sc, AGENT);
    {
        let mut p = ts::take_shared<Portfolio>(&sc);
        let cap = ts::take_from_sender<StrategistCap>(&sc);
        let mut targets = vector::empty<ID>();
        targets.push_back(object::id_from_address(POOL_B));
        lpg::rebalance(&mut p, &cap, targets, vector::empty<u64>(), 250, ts::ctx(&mut sc)); // > 100
        ts::return_to_sender(&sc, cap);
        ts::return_shared(p);
    };
    ts::end(sc);
}

#[test, expected_failure(abort_code = lpg::ECapExpired)]
fun test_rebalance_cap_expired() {
    let mut sc = ts::begin(OWNER);
    setup_portfolio(&mut sc, 100, 10_000);
    authorize_to(&mut sc, 0, AGENT); // expires at epoch 0
    // advance past expiry
    ts::next_epoch(&mut sc, OWNER);
    ts::next_epoch(&mut sc, OWNER);
    ts::next_tx(&mut sc, AGENT);
    {
        let mut p = ts::take_shared<Portfolio>(&sc);
        let cap = ts::take_from_sender<StrategistCap>(&sc);
        let mut targets = vector::empty<ID>();
        targets.push_back(object::id_from_address(POOL_B));
        lpg::rebalance(&mut p, &cap, targets, vector::empty<u64>(), 50, ts::ctx(&mut sc));
        ts::return_to_sender(&sc, cap);
        ts::return_shared(p);
    };
    ts::end(sc);
}

#[test, expected_failure(abort_code = lpg::ECapRevoked)]
fun test_rebalance_after_revoke() {
    let mut sc = ts::begin(OWNER);
    setup_portfolio(&mut sc, 100, 10_000);
    authorize_to(&mut sc, 100, AGENT);
    // owner revokes -> bumps cap_version, old cap dies
    ts::next_tx(&mut sc, OWNER);
    {
        let mut p = ts::take_shared<Portfolio>(&sc);
        lpg::revoke_cap(&mut p, ts::ctx(&mut sc));
        ts::return_shared(p);
    };
    ts::next_tx(&mut sc, AGENT);
    {
        let mut p = ts::take_shared<Portfolio>(&sc);
        let cap = ts::take_from_sender<StrategistCap>(&sc);
        let mut targets = vector::empty<ID>();
        targets.push_back(object::id_from_address(POOL_B));
        lpg::rebalance(&mut p, &cap, targets, vector::empty<u64>(), 50, ts::ctx(&mut sc));
        ts::return_to_sender(&sc, cap);
        ts::return_shared(p);
    };
    ts::end(sc);
}

#[test, expected_failure(abort_code = lpg::ECapWrongAgent)]
fun test_rebalance_wrong_agent() {
    let mut sc = ts::begin(OWNER);
    setup_portfolio(&mut sc, 100, 10_000);
    // cap authorized for AGENT but handed to ATTACKER
    authorize_to(&mut sc, 100, ATTACKER);
    ts::next_tx(&mut sc, ATTACKER);
    {
        let mut p = ts::take_shared<Portfolio>(&sc);
        let cap = ts::take_from_sender<StrategistCap>(&sc);
        let mut targets = vector::empty<ID>();
        targets.push_back(object::id_from_address(POOL_B));
        lpg::rebalance(&mut p, &cap, targets, vector::empty<u64>(), 50, ts::ctx(&mut sc));
        ts::return_to_sender(&sc, cap);
        ts::return_shared(p);
    };
    ts::end(sc);
}

/// THE non-custody invariant: a cap-holding agent cannot pull funds to themselves.
#[test, expected_failure(abort_code = lpg::ENotOwner)]
fun test_agent_cannot_withdraw_to_self() {
    let mut sc = ts::begin(OWNER);
    setup_portfolio(&mut sc, 100, 10_000);
    authorize_to(&mut sc, 100, AGENT);
    ts::next_tx(&mut sc, AGENT);
    {
        let mut p = ts::take_shared<Portfolio>(&sc);
        // Agent holds a valid StrategistCap, yet withdraw is owner-gated and recipient is hard-coded.
        lpg::withdraw(&mut p, 5000, ts::ctx(&mut sc));
        ts::return_shared(p);
    };
    ts::end(sc);
}

#[test]
fun test_owner_withdraw_succeeds() {
    let mut sc = ts::begin(OWNER);
    setup_portfolio(&mut sc, 100, 10_000);
    ts::next_tx(&mut sc, OWNER);
    {
        let mut p = ts::take_shared<Portfolio>(&sc);
        lpg::withdraw(&mut p, 4000, ts::ctx(&mut sc));
        assert!(lpg::vault_value(&p) == 6000, 0);
        ts::return_shared(p);
    };
    // owner received the coin
    ts::next_tx(&mut sc, OWNER);
    {
        let received = ts::take_from_sender<Coin<SUI>>(&sc);
        assert!(coin::value(&received) == 4000, 1);
        ts::return_to_sender(&sc, received);
    };
    ts::end(sc);
}

#[test]
fun test_mint_health_report() {
    let mut sc = ts::begin(OWNER);
    setup_portfolio(&mut sc, 100, 10_000);
    authorize_to(&mut sc, 100, AGENT);
    ts::next_tx(&mut sc, AGENT);
    {
        let mut p = ts::take_shared<Portfolio>(&sc);
        let cap = ts::take_from_sender<StrategistCap>(&sc);
        lpg::mint_health_report(
            &mut p, &cap, 42, lpg::risk_amber(),
            string::utf8(b"87% ETH cluster"), string::utf8(b"ETH 40/BTC 30/USDC 30"),
            72, ts::ctx(&mut sc),
        );
        assert!(lpg::health_score(&p) == 42, 0);
        assert!(lpg::risk_level(&p) == lpg::risk_amber(), 1);
        ts::return_to_sender(&sc, cap);
        ts::return_shared(p);
    };
    // report is frozen / immutable
    ts::next_tx(&mut sc, AGENT);
    {
        let report = ts::take_immutable<HealthReport>(&sc);
        assert!(lpg::report_score(&report) == 42, 2);
        assert!(lpg::report_risk_level(&report) == lpg::risk_amber(), 3);
        ts::return_immutable(report);
    };
    ts::end(sc);
}
