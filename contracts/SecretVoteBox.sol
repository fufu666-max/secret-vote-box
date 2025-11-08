// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SecretVoteBox - Encrypted Voting System
/// @author SecretVoteBox
/// @notice A voting system where votes are encrypted using FHEVM until polls close
contract SecretVoteBox is SepoliaConfig {
    struct Poll {
        string title;
        string description;
        string[] options;
        uint256 expireAt;
        address creator;
        bool isActive;
        mapping(uint256 => euint32) encryptedVoteCounts; // Encrypted vote count per option
        mapping(address => bool) hasVoted; // Track if user has voted
        bool finalized; // Results have been decrypted and published
    }

    uint256 public pollCount;
    mapping(uint256 => Poll) public polls;
    // Clear results storage after decryption (available to everyone)
    mapping(uint256 => uint32[]) private _clearVoteCounts;
    // Track pending decryption requests
    mapping(uint256 => uint256) private _requestToPoll;

    event PollCreated(uint256 indexed pollId, address indexed creator, string title, uint256 expireAt);
    event VoteCast(uint256 indexed pollId, address indexed voter);
    event PollEnded(uint256 indexed pollId);
    event FinalizeRequested(uint256 indexed pollId, uint256 requestId);
    event ResultsPublished(uint256 indexed pollId);

    /// @notice Create a new poll
    /// @param title The poll question/title
    /// @param description Optional description of the poll
    /// @param options Array of voting options
    /// @param expireAt Unix timestamp when poll expires
    /// @return pollId The ID of the created poll
    function createPoll(
        string memory title,
        string memory description,
        string[] memory options,
        uint256 expireAt
    ) external returns (uint256 pollId) {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(options.length >= 2, "Must have at least 2 options");
        require(expireAt > block.timestamp, "Expiration must be in the future");

        pollId = pollCount++;
        Poll storage poll = polls[pollId];
        poll.title = title;
        poll.description = description;
        poll.options = options;
        poll.expireAt = expireAt;
        poll.creator = msg.sender;
        poll.isActive = true;

        // Initialize encrypted vote counts for each option
        for (uint256 i = 0; i < options.length; i++) {
            // Initialize with encrypted zero
            poll.encryptedVoteCounts[i] = FHE.asEuint32(0);
            FHE.allowThis(poll.encryptedVoteCounts[i]);
        }

        emit PollCreated(pollId, msg.sender, title, expireAt);
    }

    /// @notice Cast a vote on a poll (encrypted)
    /// @param pollId The ID of the poll
    /// @param optionIndex The encrypted index of the option being voted for
    /// @param inputProof The input proof for the encrypted option index
    function vote(
        uint256 pollId,
        externalEuint32 optionIndex,
        bytes calldata inputProof
    ) external {
        Poll storage poll = polls[pollId];
        require(poll.isActive, "Poll does not exist or is not active");
        require(block.timestamp < poll.expireAt, "Poll has expired");
        require(!poll.hasVoted[msg.sender], "Already voted");

        euint32 encryptedOptionIndex = FHE.fromExternal(optionIndex, inputProof);

        // Increment the vote count for the selected option
        // For each option, check if it matches and add 1 if it does
        for (uint256 i = 0; i < poll.options.length; i++) {
            euint32 optionValue = FHE.asEuint32(uint32(i));
            ebool isMatch = FHE.eq(encryptedOptionIndex, optionValue);
            // Use FHE.select to conditionally add 1 if match, 0 otherwise
            euint32 voteIncrement = FHE.select(isMatch, FHE.asEuint32(1), FHE.asEuint32(0));
            poll.encryptedVoteCounts[i] = FHE.add(poll.encryptedVoteCounts[i], voteIncrement);
            FHE.allowThis(poll.encryptedVoteCounts[i]);
            FHE.allow(poll.encryptedVoteCounts[i], msg.sender);
        }

        poll.hasVoted[msg.sender] = true;
        emit VoteCast(pollId, msg.sender);
    }

    /// @notice Get poll information
    /// @param pollId The ID of the poll
    /// @return title The poll title
    /// @return description The poll description
    /// @return options Array of options
    /// @return expireAt Expiration timestamp
    /// @return creator The address of the poll creator
    /// @return isActive Whether the poll is active
    function getPoll(uint256 pollId) external view returns (
        string memory title,
        string memory description,
        string[] memory options,
        uint256 expireAt,
        address creator,
        bool isActive
    ) {
        Poll storage poll = polls[pollId];
        require(poll.isActive, "Poll does not exist");
        return (
            poll.title,
            poll.description,
            poll.options,
            poll.expireAt,
            poll.creator,
            poll.isActive
        );
    }

    /// @notice Get encrypted vote count for a specific option
    /// @param pollId The ID of the poll
    /// @param optionIndex The index of the option
    /// @return The encrypted vote count
    function getEncryptedVoteCount(uint256 pollId, uint256 optionIndex) external view returns (euint32) {
        Poll storage poll = polls[pollId];
        require(poll.isActive, "Poll does not exist");
        require(optionIndex < poll.options.length, "Invalid option index");
        return poll.encryptedVoteCounts[optionIndex];
    }

    /// @notice Check if a user has voted on a poll
    /// @param pollId The ID of the poll
    /// @param voter The address of the voter
    /// @return Whether the user has voted
    function hasVoted(uint256 pollId, address voter) external view returns (bool) {
        return polls[pollId].hasVoted[voter];
    }

    /// @notice End a poll (can be called after expiration)
    /// @param pollId The ID of the poll
    function endPoll(uint256 pollId) external {
        Poll storage poll = polls[pollId];
        require(poll.isActive, "Poll does not exist or already ended");
        require(block.timestamp >= poll.expireAt, "Poll has not expired yet");
        poll.isActive = false;
        emit PollEnded(pollId);
    }

    /// @notice Get total number of polls
    /// @return The total number of polls created
    function getPollCount() external view returns (uint256) {
        return pollCount;
    }

    /// @notice Request decryption and publish clear results (anyone can trigger after poll ended)
    /// @param pollId The ID of the poll
    function requestFinalize(uint256 pollId) external {
        Poll storage poll = polls[pollId];
        require(!poll.isActive, "Poll still active");
        require(!poll.finalized, "Already finalized");

        // Build ciphertext array
        uint256 len = poll.options.length;
        bytes32[] memory cts = new bytes32[](len);
        for (uint256 i = 0; i < len; i++) {
            cts[i] = FHE.toBytes32(poll.encryptedVoteCounts[i]);
        }

        uint256 requestId = FHE.requestDecryption(cts, this.decryptionCallback.selector);
        _requestToPoll[requestId] = pollId;
        emit FinalizeRequested(pollId, requestId);
    }

    /// @notice Callback called by the FHE decryption oracle
    /// @dev Expects concatenated uint32 cleartexts in bytes
    function decryptionCallback(uint256 requestId, bytes memory cleartexts, bytes[] memory /*signatures*/) public returns (bool) {
        uint256 pollId = _requestToPoll[requestId];
        Poll storage poll = polls[pollId];
        require(!poll.finalized, "Already finalized");
        require(!poll.isActive, "Poll still active");

        uint256 len = poll.options.length;
        // Expect len * 32 bytes (each uint256 encoded), but oracle returns packed format for uint32 in examples.
        // We parse as sequence of uint32 values from the bytes blob.
        uint32[] memory counts = new uint32[](len);
        require(cleartexts.length >= len * 4, "Invalid cleartexts length");
        for (uint256 i = 0; i < len; i++) {
            uint32 val;
            assembly {
                // read 4 bytes starting at offset (i*4 + 32) (skip bytes length slot)
                val := shr(224, mload(add(add(cleartexts, 32), mul(i, 4))))
            }
            counts[i] = val;
        }
        // Store
        delete _clearVoteCounts[pollId];
        for (uint256 i = 0; i < len; i++) {
            _clearVoteCounts[pollId].push(counts[i]);
        }
        poll.finalized = true;
        emit ResultsPublished(pollId);
        return true;
    }

    /// @notice Returns whether a poll has published clear results
    function isFinalized(uint256 pollId) external view returns (bool) {
        return polls[pollId].finalized;
    }

    /// @notice Get published clear vote counts for a poll (only available after finalize)
    function getClearVoteCounts(uint256 pollId) external view returns (uint32[] memory) {
        require(polls[pollId].finalized, "Results not available");
        return _clearVoteCounts[pollId];
    }
}

