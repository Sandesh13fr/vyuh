// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Fixture} from "../Fixture.sol";
import {ReasonCode, InvalidConfiguration} from "../../src/types/VyuhTypes.sol";
import {KycTierPolicy} from "../../src/policies/KycTierPolicy.sol";
import {IKycSBT} from "../../src/interfaces/IKycSBT.sol";

contract KycTierPolicyTest is Fixture {
    function test_notHumanIsRing6() public {
        sbt.set(owner, false, 0);
        (ReasonCode code, uint8 ring) = _check(_intent());
        assertEq(uint8(code), uint8(ReasonCode.KYC_TIER));
        assertEq(ring, 6);
    }

    function test_levelBelowMinimumIsRing6() public {
        sbt.set(owner, true, 0);
        (ReasonCode code,) = _check(_intent());
        assertEq(uint8(code), uint8(ReasonCode.KYC_TIER));
    }

    function test_allowlistFallbackWithoutSbt() public {
        KycTierPolicy p = new KycTierPolicy(address(this), IKycSBT(address(0)));
        assertFalse(p.eligible(stranger, 1));
        p.setAllowedLevel(stranger, 2);
        assertTrue(p.eligible(stranger, 2));
        assertFalse(p.eligible(stranger, 3));
        p.setAllowedLevel(stranger, 0);
        assertFalse(p.eligible(stranger, 0));
    }

    function test_allowlistAdminOnlyAndBounded() public {
        vm.expectRevert(InvalidConfiguration.selector);
        kyc.setAllowedLevel(stranger, 5);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        kyc.setAllowedLevel(stranger, 1);
    }
}
