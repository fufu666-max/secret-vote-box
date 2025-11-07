import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { SecretVoteBox, SecretVoteBox__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("SecretVoteBox")) as SecretVoteBox__factory;
  const secretVoteBoxContract = (await factory.deploy()) as SecretVoteBox;
  const secretVoteBoxContractAddress = await secretVoteBoxContract.getAddress();

  return { secretVoteBoxContract, secretVoteBoxContractAddress };
}

describe("SecretVoteBox", function () {
  let signers: Signers;
  let secretVoteBoxContract: SecretVoteBox;
  let secretVoteBoxContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ secretVoteBoxContract, secretVoteBoxContractAddress } = await deployFixture());
  });

  it("should create a poll successfully", async function () {
    const title = "Test Poll";
    const description = "This is a test poll";
    const options = ["Option 1", "Option 2", "Option 3"];
    const expireAt = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

    const tx = await secretVoteBoxContract
      .connect(signers.alice)
      .createPoll(title, description, options, expireAt);
    await tx.wait();

    const pollCount = await secretVoteBoxContract.getPollCount();
    expect(pollCount).to.eq(1n);

    const poll = await secretVoteBoxContract.getPoll(0);
    expect(poll.title).to.eq(title);
    expect(poll.description).to.eq(description);
    expect(poll.options.length).to.eq(3);
    expect(poll.options[0]).to.eq("Option 1");
    expect(poll.options[1]).to.eq("Option 2");
    expect(poll.options[2]).to.eq("Option 3");
    expect(poll.creator).to.eq(signers.alice.address);
    expect(poll.isActive).to.eq(true);
  });

  it("should cast an encrypted vote", async function () {
    const title = "Test Poll";
    const description = "This is a test poll";
    const options = ["Option 1", "Option 2"];
    const expireAt = Math.floor(Date.now() / 1000) + 86400;

    // Create poll
    let tx = await secretVoteBoxContract
      .connect(signers.alice)
      .createPoll(title, description, options, expireAt);
    await tx.wait();

    const pollId = 0;

    // Check initial vote counts are zero
    const encryptedCount0Before = await secretVoteBoxContract.getEncryptedVoteCount(pollId, 0);
    const encryptedCount1Before = await secretVoteBoxContract.getEncryptedVoteCount(pollId, 1);
    expect(encryptedCount0Before).to.not.eq(ethers.ZeroHash);
    expect(encryptedCount1Before).to.not.eq(ethers.ZeroHash);

    // Decrypt initial counts (should be 0)
    const clearCount0Before = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCount0Before,
      secretVoteBoxContractAddress,
      signers.alice,
    );
    const clearCount1Before = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCount1Before,
      secretVoteBoxContractAddress,
      signers.alice,
    );
    expect(clearCount0Before).to.eq(0);
    expect(clearCount1Before).to.eq(0);

    // Encrypt option index 0
    const encryptedOptionIndex = await fhevm
      .createEncryptedInput(secretVoteBoxContractAddress, signers.alice.address)
      .add32(0)
      .encrypt();

    // Cast vote for option 0
    tx = await secretVoteBoxContract
      .connect(signers.alice)
      .vote(pollId, encryptedOptionIndex.handles[0], encryptedOptionIndex.inputProof);
    await tx.wait();

    // Check vote counts after voting
    const encryptedCount0After = await secretVoteBoxContract.getEncryptedVoteCount(pollId, 0);
    const encryptedCount1After = await secretVoteBoxContract.getEncryptedVoteCount(pollId, 1);

    // Decrypt counts
    const clearCount0After = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCount0After,
      secretVoteBoxContractAddress,
      signers.alice,
    );
    const clearCount1After = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCount1After,
      secretVoteBoxContractAddress,
      signers.alice,
    );

    expect(clearCount0After).to.eq(1);
    expect(clearCount1After).to.eq(0);

    // Check that user has voted
    const hasVoted = await secretVoteBoxContract.hasVoted(pollId, signers.alice.address);
    expect(hasVoted).to.eq(true);
  });

  it("should prevent double voting", async function () {
    const title = "Test Poll";
    const description = "This is a test poll";
    const options = ["Option 1", "Option 2"];
    const expireAt = Math.floor(Date.now() / 1000) + 86400;

    // Create poll
    let tx = await secretVoteBoxContract
      .connect(signers.alice)
      .createPoll(title, description, options, expireAt);
    await tx.wait();

    const pollId = 0;

    // Encrypt option index 0
    const encryptedOptionIndex = await fhevm
      .createEncryptedInput(secretVoteBoxContractAddress, signers.alice.address)
      .add32(0)
      .encrypt();

    // Cast first vote
    tx = await secretVoteBoxContract
      .connect(signers.alice)
      .vote(encryptedOptionIndex.handles[0], encryptedOptionIndex.inputProof);
    await tx.wait();

    // Try to vote again (should fail)
    const encryptedOptionIndex2 = await fhevm
      .createEncryptedInput(secretVoteBoxContractAddress, signers.alice.address)
      .add32(1)
      .encrypt();

    await expect(
      secretVoteBoxContract
        .connect(signers.alice)
        .vote(pollId, encryptedOptionIndex2.handles[0], encryptedOptionIndex2.inputProof)
    ).to.be.revertedWith("Already voted");
  });

  it("should allow multiple users to vote", async function () {
    const title = "Test Poll";
    const description = "This is a test poll";
    const options = ["Option 1", "Option 2"];
    const expireAt = Math.floor(Date.now() / 1000) + 86400;

    // Create poll
    let tx = await secretVoteBoxContract
      .connect(signers.alice)
      .createPoll(title, description, options, expireAt);
    await tx.wait();

    const pollId = 0;

    // Alice votes for option 0
    const encryptedOptionIndex0 = await fhevm
      .createEncryptedInput(secretVoteBoxContractAddress, signers.alice.address)
      .add32(0)
      .encrypt();

    tx = await secretVoteBoxContract
      .connect(signers.alice)
      .vote(pollId, encryptedOptionIndex0.handles[0], encryptedOptionIndex0.inputProof);
    await tx.wait();

    // Bob votes for option 1
    const encryptedOptionIndex1 = await fhevm
      .createEncryptedInput(secretVoteBoxContractAddress, signers.bob.address)
      .add32(1)
      .encrypt();

    tx = await secretVoteBoxContract
      .connect(signers.bob)
      .vote(pollId, encryptedOptionIndex1.handles[0], encryptedOptionIndex1.inputProof);
    await tx.wait();

    // Check vote counts
    const encryptedCount0 = await secretVoteBoxContract.getEncryptedVoteCount(pollId, 0);
    const encryptedCount1 = await secretVoteBoxContract.getEncryptedVoteCount(pollId, 1);

    const clearCount0 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCount0,
      secretVoteBoxContractAddress,
      signers.alice,
    );
    const clearCount1 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCount1,
      secretVoteBoxContractAddress,
      signers.alice,
    );

    expect(clearCount0).to.eq(1);
    expect(clearCount1).to.eq(1);
  });
});

