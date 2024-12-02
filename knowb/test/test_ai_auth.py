from src.api.ai.logging import llm_call
import pytest

RUN_TESTS_THAT_COST_MONEY = False


def test_anthropic_auth():
    """Test Anthropic API authentication via litellm"""
    if not RUN_TESTS_THAT_COST_MONEY:
        pytest.skip("Skipping test that costs money")
    try:
        response = llm_call(
            model="claude-3-5-sonnet-20240620",
            messages=[
                {
                    "role": "user",
                    "content": "Please respond with 'ok' if you can read this message.",
                }
            ],
        )
        print("Authentication test response:", response.choices[0].message.content)
        assert (
            response.choices[0].message.content == "ok"
        ), "Unexpected response content"
    except Exception as e:
        pytest.fail(f"Authentication test failed: {str(e)}")
