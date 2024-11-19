import type { MatchersContract } from "../contracts.js";
import type { EthereumProvider } from "@ignored/hardhat-vnext/types/providers";
import type { HardhatEthers } from "@ignored/hardhat-vnext-ethers/types";

import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import util from "node:util";

import { createHardhatRuntimeEnvironment } from "@ignored/hardhat-vnext/hre";
import { HardhatError } from "@ignored/hardhat-vnext-errors";
import hardhatEthersPlugin from "@ignored/hardhat-vnext-ethers";
import {
  assertRejectsWithHardhatError,
  useFixtureProject,
} from "@nomicfoundation/hardhat-test-utils";
import { AssertionError, expect } from "chai";

import "../../src/internal/add-chai-matchers";
import {
  runSuccessfulAsserts,
  runFailedAsserts,
  mineSuccessfulTransaction,
  mineRevertedTransaction,
} from "../helpers.js";

describe("INTEGRATION: Reverted", () => {
  describe("with the in-process hardhat network", () => {
    useFixtureProject("hardhat-project");
    runTests();
  });

  // TODO: when V3 node is ready, add this functionality
  // describe("connected to a hardhat node", ()=>{
  //   useEnvironmentWithNode("hardhat-project");
  //   runTests();
  // });

  function runTests() {
    // deploy Matchers contract before each test
    let matchers: MatchersContract;

    let provider: EthereumProvider;
    let ethers: HardhatEthers;

    beforeEach(async () => {
      const hre = await createHardhatRuntimeEnvironment({
        paths: {
          artifacts: `${process.cwd()}/artifacts`,
        },
        plugins: [hardhatEthersPlugin],
      });

      ({ ethers, provider } = await hre.network.connect());

      const Matchers = await ethers.getContractFactory<[], MatchersContract>(
        "Matchers",
      );
      matchers = await Matchers.deploy();
    });

    // helpers
    const expectAssertionError = async (x: Promise<void>, message: string) => {
      return expect(x).to.be.eventually.rejectedWith(AssertionError, message);
    };

    describe("with a string as its subject", () => {
      it("hash of a successful transaction", async () => {
        const { hash } = await mineSuccessfulTransaction(provider, ethers);

        await expectAssertionError(
          expect(hash).to.be.reverted(ethers),
          "Expected transaction to be reverted",
        );
        await expect(hash).to.not.be.reverted(ethers);
      });

      it("hash of a reverted transaction", async () => {
        const { hash } = await mineRevertedTransaction(
          provider,
          ethers,
          matchers,
        );

        await expect(hash).to.be.reverted(ethers);
        await expectAssertionError(
          expect(hash).to.not.be.reverted(ethers),
          "Expected transaction NOT to be reverted",
        );
      });

      it("invalid string", async () => {
        await assertRejectsWithHardhatError(
          () => expect("0x123").to.be.reverted(ethers),
          HardhatError.ERRORS.CHAI_MATCHERS.EXPECTED_VALID_TRANSACTION_HASH,
          {
            hash: "0x123",
          },
        );

        await assertRejectsWithHardhatError(
          () => expect("0x123").to.not.be.reverted(ethers),
          HardhatError.ERRORS.CHAI_MATCHERS.EXPECTED_VALID_TRANSACTION_HASH,
          {
            hash: "0x123",
          },
        );
      });

      it("promise of a hash of a successful transaction", async () => {
        const { hash } = await mineSuccessfulTransaction(provider, ethers);
        await expectAssertionError(
          expect(Promise.resolve(hash)).to.be.reverted(ethers),
          "Expected transaction to be reverted",
        );
        await expect(Promise.resolve(hash)).to.not.be.reverted(ethers);
      });

      it("promise of a hash of a reverted transaction", async () => {
        const { hash } = await mineRevertedTransaction(
          provider,
          ethers,
          matchers,
        );
        await expect(Promise.resolve(hash)).to.be.reverted(ethers);
        await expectAssertionError(
          expect(Promise.resolve(hash)).to.not.be.reverted(ethers),
          "Expected transaction NOT to be reverted",
        );
      });

      it("promise of an invalid string", async () => {
        await assertRejectsWithHardhatError(
          () => expect(Promise.resolve("0x123")).to.be.reverted(ethers),
          HardhatError.ERRORS.CHAI_MATCHERS.EXPECTED_VALID_TRANSACTION_HASH,
          {
            hash: "0x123",
          },
        );

        await assertRejectsWithHardhatError(
          () => expect(Promise.resolve("0x123")).to.not.be.reverted(ethers),
          HardhatError.ERRORS.CHAI_MATCHERS.EXPECTED_VALID_TRANSACTION_HASH,
          {
            hash: "0x123",
          },
        );
      });

      it("promise of an byte32 string", async () => {
        await expect(
          Promise.resolve(
            "0x3230323400000000000000000000000000000000000000000000000000000000",
          ),
        ).not.to.be.reverted(ethers);
      });
    });

    describe("with a TxResponse as its subject", () => {
      it("TxResponse of a successful transaction", async () => {
        const tx = await mineSuccessfulTransaction(provider, ethers);

        await expectAssertionError(
          expect(tx).to.be.reverted(ethers),
          "Expected transaction to be reverted",
        );
        await expect(tx).to.not.be.reverted(ethers);
      });

      it("TxResponse of a reverted transaction", async () => {
        const tx = await mineRevertedTransaction(provider, ethers, matchers);

        await expect(tx).to.be.reverted(ethers);
        await expectAssertionError(
          expect(tx).to.not.be.reverted(ethers),
          "Expected transaction NOT to be reverted",
        );
      });

      it("promise of a TxResponse of a successful transaction", async () => {
        const txPromise = mineSuccessfulTransaction(provider, ethers);

        await expectAssertionError(
          expect(txPromise).to.be.reverted(ethers),
          "Expected transaction to be reverted",
        );
        await expect(txPromise).to.not.be.reverted(ethers);
      });

      it("promise of a TxResponse of a reverted transaction", async () => {
        const txPromise = mineRevertedTransaction(provider, ethers, matchers);

        await expect(txPromise).to.be.reverted(ethers);
        await expectAssertionError(
          expect(txPromise).to.not.be.reverted(ethers),
          "Expected transaction NOT to be reverted",
        );
      });

      // it("reverted: should throw if chained to another non-chainable method", ()=>{
      //   const txPromise = mineRevertedTransaction(provider, ethers, matchers);

      //   expect(() =>
      //     expect(txPromise)
      //       .to.be.revertedWith("an error message")
      //       .and.to.be.reverted(ethers),
      //   ).to.throw(
      //     /The matcher 'reverted' cannot be chained after 'revertedWith'./,
      //   );
      // });

      // it("revertedWith: should throw if chained to another non-chainable method", ()=>{
      //   const txPromise = mineRevertedTransaction(provider, ethers, matchers);

      //   expect(() =>
      //     expect(txPromise)
      //       .to.be.revertedWithCustomError(matchers, "SomeCustomError")
      //       .and.to.be.revertedWith("an error message"),
      //   ).to.throw(
      //     /The matcher 'revertedWith' cannot be chained after 'revertedWithCustomError'./,
      //   );
      // });

      // it("revertedWithCustomError: should throw if chained to another non-chainable method", ()=>{
      //   const txPromise = mineRevertedTransaction(provider, ethers, matchers);
      //   expect(() =>
      //     expect(txPromise)
      //       .to.be.revertedWithoutReason()
      //       .and.to.be.revertedWithCustomError(matchers, "SomeCustomError"),
      //   ).to.throw(
      //     /The matcher 'revertedWithCustomError' cannot be chained after 'revertedWithoutReason'./,
      //   );
      // });

      // it("revertedWithoutReason: should throw if chained to another non-chainable method", ()=>{
      //   const txPromise = mineRevertedTransaction(provider, ethers, matchers);
      //   expect(() =>
      //     expect(txPromise)
      //       .to.be.revertedWithPanic()
      //       .and.to.be.revertedWithoutReason(),
      //   ).to.throw(
      //     /The matcher 'revertedWithoutReason' cannot be chained after 'revertedWithPanic'./,
      //   );
      // });

      // it("revertedWithPanic: should throw if chained to another non-chainable method", async ()=>{
      //   const [sender] = await ethers.getSigners();
      //   const txPromise = mineRevertedTransaction(provider, ethers, matchers);
      //   expect(() =>
      //     expect(txPromise)
      //       .to.changeEtherBalance(sender, "-200")
      //       .and.to.be.revertedWithPanic(),
      //   ).to.throw(
      //     /The matcher 'revertedWithPanic' cannot be chained after 'changeEtherBalance'./,
      //   );
      // });
    });

    describe("with a TxReceipt as its subject", () => {
      it("TxReceipt of a successful transaction", async () => {
        const tx = await mineSuccessfulTransaction(provider, ethers);
        const receipt = await tx.wait();

        await expectAssertionError(
          expect(receipt).to.be.reverted(ethers),
          "Expected transaction to be reverted",
        );
        await expect(receipt).to.not.be.reverted(ethers);
      });

      it("TxReceipt of a reverted transaction", async () => {
        const tx = await mineRevertedTransaction(provider, ethers, matchers);
        const receipt = await ethers.provider.getTransactionReceipt(tx.hash); // tx.wait rejects, so we use provider.getTransactionReceipt

        await expect(receipt).to.be.reverted(ethers);
        await expectAssertionError(
          expect(receipt).to.not.be.reverted(ethers),
          "Expected transaction NOT to be reverted",
        );
      });

      it("promise of a TxReceipt of a successful transaction", async () => {
        const tx = await mineSuccessfulTransaction(provider, ethers);
        const receiptPromise = tx.wait();

        await expectAssertionError(
          expect(receiptPromise).to.be.reverted(ethers),
          "Expected transaction to be reverted",
        );
        await expect(receiptPromise).to.not.be.reverted(ethers);
      });

      it("promise of a TxReceipt of a reverted transaction", async () => {
        const tx = await mineRevertedTransaction(provider, ethers, matchers);
        const receiptPromise = ethers.provider.getTransactionReceipt(tx.hash); // tx.wait rejects, so we use provider.getTransactionReceipt

        await expect(receiptPromise).to.be.reverted(ethers);
        await expectAssertionError(
          expect(receiptPromise).to.not.be.reverted(ethers),
          "Expected transaction NOT to be reverted",
        );
      });
    });

    describe("calling a contract method that succeeds", () => {
      it("successful asserts", async () => {
        await runSuccessfulAsserts({
          matchers,
          method: "succeeds",
          args: [],
          successfulAssert: (x) => expect(x).to.not.be.reverted(ethers),
        });
      });

      it("failed asserts", async () => {
        await runFailedAsserts({
          matchers,
          method: "succeeds",
          args: [],
          failedAssert: (x) => expect(x).to.be.reverted(ethers),
          failedAssertReason: "Expected transaction to be reverted",
        });
      });
    });

    describe("calling a method that reverts without a reason", () => {
      // depends on a bug being fixed on ethers.js
      // see https://github.com/NomicFoundation/hardhat/issues/3446
      it.skip("successful asserts", async () => {
        await runSuccessfulAsserts({
          matchers,
          method: "revertsWithoutReason",
          args: [],
          successfulAssert: (x) => expect(x).to.be.reverted(ethers),
        });
      });

      // depends on a bug being fixed on ethers.js
      // see https://github.com/NomicFoundation/hardhat/issues/3446
      it.skip("failed asserts", async () => {
        await runFailedAsserts({
          matchers,
          method: "revertsWithoutReason",
          args: [],
          failedAssert: (x) => expect(x).not.to.be.reverted(ethers),
          failedAssertReason: "Expected transaction NOT to be reverted",
        });
      });
    });

    describe("calling a method that reverts with a reason string", () => {
      it("successful asserts", async () => {
        await runSuccessfulAsserts({
          matchers,
          method: "revertsWith",
          args: ["some reason"],
          successfulAssert: (x) => expect(x).to.be.reverted(ethers),
        });
      });

      it("failed asserts", async () => {
        await runFailedAsserts({
          matchers,
          method: "revertsWith",
          args: ["some reason"],
          failedAssert: (x) => expect(x).not.to.be.reverted(ethers),
          failedAssertReason:
            "Expected transaction NOT to be reverted, but it reverted with reason 'some reason'",
        });
      });
    });

    describe("calling a method that reverts with a panic code", () => {
      it("successful asserts", async () => {
        await runSuccessfulAsserts({
          matchers,
          method: "panicAssert",
          args: [],
          successfulAssert: (x) => expect(x).to.be.reverted(ethers),
        });
      });

      it("failed asserts", async () => {
        await runFailedAsserts({
          matchers,
          method: "panicAssert",
          args: [],
          failedAssert: (x) => expect(x).not.to.be.reverted(ethers),
          failedAssertReason:
            "Expected transaction NOT to be reverted, but it reverted with panic code 0x01 (Assertion error)",
        });
      });
    });

    describe("calling a method that reverts with a custom error", () => {
      it("successful asserts", async () => {
        await runSuccessfulAsserts({
          matchers,
          method: "revertWithSomeCustomError",
          args: [],
          successfulAssert: (x) => expect(x).to.be.reverted(ethers),
        });
      });

      it("failed asserts", async () => {
        await runFailedAsserts({
          matchers,
          method: "revertWithSomeCustomError",
          args: [],
          failedAssert: (x) => expect(x).not.to.be.reverted(ethers),
          failedAssertReason: "Expected transaction NOT to be reverted",
        });
      });
    });

    describe("invalid rejection values", () => {
      it("non-errors", async () => {
        await expectAssertionError(
          expect(Promise.reject({})).to.be.reverted(ethers),
          "Expected an Error object",
        );
      });

      it("errors that are not related to a reverted transaction", async () => {
        // use an address that almost surely doesn't have balance
        const randomPrivateKey =
          "0xc5c587cc6e48e9692aee0bf07474118e6d830c11905f7ec7ff32c09c99eba5f9";
        const signer = new ethers.Wallet(randomPrivateKey, ethers.provider);

        const matchersFromSenderWithoutFunds = matchers.connect(
          signer,
        ) as MatchersContract;

        // this transaction will fail because of lack of funds, not because of a
        // revert
        await expect(
          expect(
            matchersFromSenderWithoutFunds.revertsWithoutReason({
              gasLimit: 1_000_000,
            }),
          ).to.not.be.reverted(ethers),
        ).to.be.eventually.rejectedWith(
          "Sender doesn't have enough funds to send tx. The max upfront cost is: 2750000000000000 and the sender's balance is: 0.",
        );
      });
    });

    describe("stack traces", () => {
      // smoke test for stack traces
      it("includes test file", async () => {
        try {
          await expect(matchers.succeeds()).to.be.reverted(ethers);
        } catch (e: any) {
          const errorString = util.inspect(e);
          expect(errorString).to.include("Expected transaction to be reverted");
          expect(errorString).to.include(
            path.join("test", "reverted", "reverted.ts"),
          );
          return;
        }
        expect.fail("Expected an exception but none was thrown");
      });
    });
  }
});