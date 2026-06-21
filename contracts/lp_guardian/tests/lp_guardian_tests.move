#[test_only]
module lp_guardian::lp_guardian_tests {
    use lp_guardian::lp_guardian::{Self, Portfolio, StrategistCap};
    use sui::test_scenario as ts;

    const OWNER: address = @0xA;
    const AGENT: address = @0xB;
    const POOL: address = @0xC0FFEE;

    #[test]
    fun test_create_and_authorize() {
        let mut sc = ts::begin(OWNER);
        lp_guardian::create_portfolio(ts::ctx(&mut sc));

        ts::next_tx(&mut sc, OWNER);
        let mut portfolio = ts::take_shared<Portfolio>(&sc);
        lp_guardian::whitelist_pool(&mut portfolio, POOL, ts::ctx(&mut sc));
        let cap = lp_guardian::authorize_strategist(&portfolio, AGENT, 100, ts::ctx(&mut sc));

        assert!(!lp_guardian::is_revoked(&cap), 0);
        assert!(lp_guardian::owner(&portfolio) == OWNER, 1);

        transfer::public_transfer(cap, AGENT);
        ts::return_shared(portfolio);
        ts::end(sc);
    }

    #[test]
    fun test_agent_can_rebalance_whitelisted() {
        let mut sc = ts::begin(OWNER);
        lp_guardian::create_portfolio(ts::ctx(&mut sc));

        ts::next_tx(&mut sc, OWNER);
        let mut portfolio = ts::take_shared<Portfolio>(&sc);
        lp_guardian::whitelist_pool(&mut portfolio, POOL, ts::ctx(&mut sc));
        let cap = lp_guardian::authorize_strategist(&portfolio, AGENT, 100, ts::ctx(&mut sc));

        // agent rebalances into a whitelisted pool, within slippage cap
        lp_guardian::rebalance(&mut portfolio, &cap, POOL, 80, 100, ts::ctx(&mut sc));

        transfer::public_transfer(cap, AGENT);
        ts::return_shared(portfolio);
        ts::end(sc);
    }

    #[test]
    #[expected_failure(abort_code = lp_guardian::lp_guardian::EPoolNotWhitelisted)]
    fun test_agent_cannot_rebalance_unwhitelisted() {
        let mut sc = ts::begin(OWNER);
        lp_guardian::create_portfolio(ts::ctx(&mut sc));

        ts::next_tx(&mut sc, OWNER);
        let mut portfolio = ts::take_shared<Portfolio>(&sc);
        let cap = lp_guardian::authorize_strategist(&portfolio, AGENT, 100, ts::ctx(&mut sc));

        // POOL was never whitelisted → must abort.
        lp_guardian::rebalance(&mut portfolio, &cap, POOL, 80, 100, ts::ctx(&mut sc));

        transfer::public_transfer(cap, AGENT);
        ts::return_shared(portfolio);
        ts::end(sc);
    }

    #[test]
    #[expected_failure(abort_code = lp_guardian::lp_guardian::ENotOwner)]
    fun test_agent_cannot_withdraw_to_self() {
        // The non-custody invariant: `withdraw` is owner-only and always pays
        // the owner. The agent cannot call it. There is no other value-moving
        // function besides bounded `rebalance`.
        let mut sc = ts::begin(OWNER);
        lp_guardian::create_portfolio(ts::ctx(&mut sc));

        ts::next_tx(&mut sc, AGENT); // agent tries to withdraw
        let portfolio = ts::take_shared<Portfolio>(&sc);
        lp_guardian::withdraw(&portfolio, ts::ctx(&mut sc)); // aborts ENotOwner
        ts::return_shared(portfolio);
        ts::end(sc);
    }
}
