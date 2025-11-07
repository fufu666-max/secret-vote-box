import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { SecretVoteBox } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

describe("SecretVoteBoxSepolia", function () {
  let signers: Signers;
  let secretVoteBoxContract: SecretVoteBox;
  let secretVoteBoxContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const SecretVoteBoxDeployment = await deployments.get("SecretVoteBox");
      secretVoteBoxContractAddress = SecretVoteBoxDeployment.address;
      secretVoteBoxContract = await ethers.getContractAt("SecretVoteBox", SecretVoteBoxDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0], bob: ethSigners[1] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("should create a poll and cast encrypted votes", async function () {
    steps = 15;

    this.timeout(4 * 40000);

    const title = "Sepolia Test Poll";
    const description = "This is a test poll on Sepolia";
    const options = ["Option 1", "Option 2"];
    const expireAt = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

    progress(`Creating poll: ${title}...`);
    let tx = await secretVoteBoxContract
      .connect(signers.alice)
      .createPoll(title, description, options, expireAt);
    await tx.wait();

    const pollId = 0;
    progress(`Poll created with ID: ${pollId}`);

    progress(`Getting poll information...`);
    const poll = await secretVoteBoxContract.getPoll(pollId);
    expect(poll.title).to.eq(title);
    expect(poll.description).to.eq(description);
    expect(poll.options.length).to.eq(2);

    progress(`Getting initial encrypted vote counts...`);
    const encryptedCount0Before = await secretVoteBoxContract.getEncryptedVoteCount(pollId, 0);
    const encryptedCount1Before = await secretVoteBoxContract.getEncryptedVoteCount(pollId, 1);

    progress(`Decrypting initial vote counts...`);
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
    progress(`Initial counts: Option 0 = ${clearCount0Before}, Option 1 = ${clearCount1Before}`);
    expect(clearCount0Before).to.eq(0);
    expect(clearCount1Before).to.eq(0);

    progress(`Encrypting option index 0...`);
    const encryptedOptionIndex0 = await fhevm
      .createEncryptedInput(secretVoteBoxContractAddress, signers.alice.address)
      .add32(0)
      .encrypt();

    progress(`Casting vote for option 0...`);
    tx = await secretVoteBoxContract
      .connect(signers.alice)
      .vote(pollId, encryptedOptionIndex0.handles[0], encryptedOptionIndex0.inputProof);
    await tx.wait();

    progress(`Getting encrypted vote counts after vote...`);
    const encryptedCount0After = await secretVoteBoxContract.getEncryptedVoteCount(pollId, 0);
    const encryptedCount1After = await secretVoteBoxContract.getEncryptedVoteCount(pollId, 1);

    progress(`Decrypting vote counts after vote...`);
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
    progress(`Final counts: Option 0 = ${clearCount0After}, Option 1 = ${clearCount1After}`);

    expect(clearCount0After).to.eq(1);
    expect(clearCount1After).to.eq(0);

    progress(`Checking if user has voted...`);
    const hasVoted = await secretVoteBoxContract.hasVoted(pollId, signers.alice.address);
    expect(hasVoted).to.eq(true);
  });
});

