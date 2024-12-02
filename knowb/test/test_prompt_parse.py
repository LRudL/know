import pytest
from src.api.ai.prompts import parse_graph_output


# Example valid output string
VALID_OUTPUT_SIMPLE = """Some brainstorming text here...

NODES
{"order_index": 1, "summary": "First concept", "content": "Content for first concept", "supporting_quotes": ["Quote 1", "Quote 2"]}
{"order_index": 2, "summary": "Second concept", "content": "Content for second concept", "supporting_quotes": ["Quote 3"]}

EDGES
{"parent_index": 1, "child_index": 2}
"""


def test_parse_graph_output_valid():
    nodes, edges = parse_graph_output(VALID_OUTPUT_SIMPLE)

    assert len(nodes) == 2
    assert len(edges) == 1

    # Check first node
    assert nodes[0].order_index == 1
    assert nodes[0].summary == "First concept"
    assert len(nodes[0].supporting_quotes) == 2

    # Check second node
    assert nodes[1].order_index == 2
    assert nodes[1].summary == "Second concept"
    assert len(nodes[1].supporting_quotes) == 1

    # Check edge exists between first and second node
    assert any(e.parent_id == nodes[0].id and e.child_id == nodes[1].id for e in edges)


VALID_OUTPUT_CLAUDE = """Let me add a few final thoughts before creating the structured output:

The key challenge is balancing granularity. We need nodes fine-grained enough to show clear prerequisites, but not so granular that the structure becomes unwieldy. I'll focus on concepts that represent meaningful learning units.

For the edges, I'll be careful to only include direct prerequisites, not transitive ones. For example, if understanding BCH codes requires Hamming codes, which requires repetition codes, I'll only show Hamming→BCH and repetition→Hamming, not repetition→BCH.

NODES
{"order_index": 1, "summary": "The Fundamental Problem of Communication", "content": "Information must be transmitted over noisy channels that introduce errors. The core challenge is reproducing a message either exactly or approximately at the receiving end despite these errors.", "supporting_quotes": ["The fundamental problem of communication is that of reproducing at one point either exactly or approximately a message selected at another point.", "These channels are noisy. A telephone line suffers from cross-talk with other lines; the hardware in the line distorts and adds noise to the transmitted signal."]}
{"order_index": 2, "summary": "Binary Symmetric Channel", "content": "A basic model of a noisy channel where each bit has probability f of being flipped. This provides a mathematical framework for analyzing error rates and correction strategies.", "supporting_quotes": ["Let's consider a noisy disk drive that transmits each bit correctly with probability (1−f) and incorrectly with probability f. This model communication channel is known as the binary symmetric channel"]}
{"order_index": 3, "summary": "Physical Solution Approach", "content": "Improve the physical characteristics of the communication channel to reduce error probability. Examples include better components, environmental control, and stronger signals.", "supporting_quotes": ["The physical solution is to improve the physical characteristics of the communication channel to reduce its error probability. We could improve our disk drive by", "1. using more reliable components in its circuitry;", "2. evacuating the air from the disk enclosure so as to eliminate the turbulence that perturbs the reading head from the track;"]}
{"order_index": 4, "summary": "System Solution Approach", "content": "Add encoding and decoding systems to detect and correct errors, accepting the channel as it is. This approach uses redundancy to achieve reliability.", "supporting_quotes": ["Information theory and coding theory offer an alternative (and much more exciting) approach: we accept the given noisy channel as it is and add communication systems to it so that we can detect and correct the errors introduced by the channel."]}
{"order_index": 5, "summary": "Simple Repetition Codes", "content": "The most basic error-correcting code: repeat each bit multiple times and use majority voting to decode. Simple but inefficient, requiring many repetitions for high reliability.", "supporting_quotes": ["A straightforward idea is to repeat every bit of the message a prearranged number of times", "The error probability is dominated by the probability that two bits in a block of three are flipped, which scales as f²."]}
{"order_index": 6, "summary": "Rate vs Reliability Trade-off", "content": "Fundamental tension between communication rate (efficiency) and error probability. Simple repetition codes show this clearly: more repetitions means lower rate but better reliability.", "supporting_quotes": ["Yet we have lost something: our rate of information transfer has fallen by a factor of three. So if we use a repetition code to communicate data over a telephone line, it will reduce the error frequency, but it will also reduce our communication rate."]}
{"order_index": 7, "summary": "Block Codes Concept", "content": "Codes that operate on blocks of data bits rather than individual bits. Add redundancy through parity-check bits that are linear functions of the source bits.", "supporting_quotes": ["A block code is a rule for converting a sequence of source bits s, of length K, say, into a transmitted sequence t of length N bits. To add redundancy, we make N greater than K."]}
{"order_index": 8, "summary": "Hamming (7,4) Code", "content": "A specific block code that encodes 4 data bits into 7 transmitted bits using 3 parity checks. Can correct any single bit error.", "supporting_quotes": ["An example of a linear block code is the (7, 4) Hamming code, which transmits N = 7 bits for every K = 4 source bits.", "By including three parity-check bits in a block of 7 bits it is possible to detect and correct any single bit error in each block."]}
{"order_index": 9, "summary": "Syndrome Decoding", "content": "Efficient decoding method for linear codes. Uses the pattern of parity check violations (syndrome) to identify likely error patterns.", "supporting_quotes": ["The pattern of violations of the parity checks is called the syndrome", "To solve the decoding task, we ask the question: can we find a unique bit that lies inside all the 'unhappy' circles and outside all the 'happy' circles?"]}
{"order_index": 10, "summary": "Shannon's Channel Coding Theorem", "content": "Theoretical result showing that reliable communication is possible at non-zero rates up to channel capacity. Revolutionary because it showed good codes exist in principle.", "supporting_quotes": ["However, Shannon proved the remarkable result that the boundary between achievable and nonachievable points meets the R axis at a non-zero value R = C", "Information can be communicated over a noisy channel at a non-zero rate with arbitrarily small error probability."]}
{"order_index": 11, "summary": "Channel Capacity", "content": "The maximum rate at which reliable communication is possible over a given channel. Depends on channel properties like noise level.", "supporting_quotes": ["The maximum rate at which communication is possible with arbitrarily small pb is called the capacity of the channel. The formula for the capacity of a binary symmetric channel with noise level f is", "C(f) = 1 − H2(f)"]}

EDGES
{"parent_index": 1, "child_index": 2}
{"parent_index": 1, "child_index": 3}
{"parent_index": 1, "child_index": 4}
{"parent_index": 2, "child_index": 5}
{"parent_index": 2, "child_index": 6}
{"parent_index": 4, "child_index": 5}
{"parent_index": 5, "child_index": 6}
{"parent_index": 5, "child_index": 7}
{"parent_index": 7, "child_index": 8}
{"parent_index": 8, "child_index": 9}
{"parent_index": 6, "child_index": 10}
{"parent_index": 2, "child_index": 11}
{"parent_index": 10, "child_index": 11}
"""


def test_parse_graph_output_claude():
    nodes, edges = parse_graph_output(VALID_OUTPUT_CLAUDE)

    assert len(nodes) == 11
    assert len(edges) == 13
