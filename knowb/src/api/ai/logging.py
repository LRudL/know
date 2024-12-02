import functools
import json
import logging
from datetime import datetime
import os
import litellm
from anthropic import Anthropic
import sys

# Set verbose to True to see more detailed logs
# litellm.set_verbose = True # this is deprecated, instead:
os.environ["LITELLM_LOG"] = "DEBUG"


# Configure logging to write to a file in a logs directory
LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)

# Create a new log file for each day
log_file = os.path.join(LOG_DIR, f"llm_{datetime.now().strftime('%Y%m%d')}.log")

# Create two loggers: one for console, one for file
console_logger = logging.getLogger("llm.console")
file_logger = logging.getLogger("llm.file")

# Configure console logger (simple format, no JSON)
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)
console_handler.setFormatter(
    logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
)
console_logger.addHandler(console_handler)
console_logger.setLevel(logging.DEBUG)

# Configure file logger (detailed format, with JSON)
file_handler = logging.FileHandler(log_file)
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(
    logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
)
file_logger.addHandler(file_handler)
file_logger.setLevel(logging.DEBUG)


def log_llm_call(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        # Create a clean version of the request for logging
        log_kwargs = kwargs.copy()

        # For debugging, let's print the actual data length before removal
        if "messages" in log_kwargs:
            for msg in log_kwargs["messages"]:
                if isinstance(msg.get("content"), list):
                    for content in msg["content"]:
                        if (
                            isinstance(content, dict)
                            and content.get("type") == "document"
                            and "data" in content.get("source", {})
                        ):
                            print(
                                f"DEBUG: Base64 data length before removal: {len(content['source']['data'])}",
                                file=sys.stderr,
                            )
                            print(
                                f"DEBUG: Base64 data starts with: {content['source']['data'][:50]}",
                                file=sys.stderr,
                            )

        model = kwargs.get("model", "unknown_model")

        # Calculate input tokens
        input_tokens = litellm.token_counter(
            model=model, messages=kwargs.get("messages", [])
        )

        # Log the request
        console_logger.debug(f"LLM Request - Model: {model}")
        console_logger.debug(f"LLM Request - Input tokens: {input_tokens}")

        file_logger.debug(f"LLM Request - Model: {model}")
        file_logger.debug(f"LLM Request - Input tokens: {input_tokens}")
        file_logger.debug(
            f"LLM Request - Headers: {json.dumps(kwargs.get('headers', {}), indent=2)}"
        )
        file_logger.debug(f"LLM Request - Payload: {json.dumps(log_kwargs, indent=2)}")

        # Make the actual API call
        try:
            response = func(*args, **kwargs)

            # Get output tokens and cost
            output_tokens = len(
                response.choices[0].message.content
            )  # This is an approximation
            total_cost = litellm.completion_cost(completion_response=response)

            # Log the response
            console_logger.debug(f"LLM Response - Output tokens: {output_tokens}")
            console_logger.debug(f"LLM Response - Total cost: ${total_cost:.6f}")

            file_logger.debug(f"LLM Response - Output tokens: {output_tokens}")
            file_logger.debug(f"LLM Response - Total cost: ${total_cost:.6f}")
            file_logger.debug(
                f"LLM Response - Content: {json.dumps(response.dict(), indent=2)}"
            )

            return response
        except Exception as e:
            error_msg = f"LLM Error: {str(e)}"
            console_logger.error(error_msg)
            file_logger.error(error_msg)
            raise

    return wrapper


# Wrap the completion function with our logging decorator
llm_call = log_llm_call(litellm.completion)


def log_anthropic_call(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        # Debug the actual request before any modification
        print("\nDEBUG ANTHROPIC REQUEST:", file=sys.stderr)
        if "messages" in kwargs:
            for msg in kwargs["messages"]:
                if isinstance(msg.get("content"), list):
                    for content in msg["content"]:
                        if (
                            isinstance(content, dict)
                            and content.get("type") == "document"
                            and "source" in content
                            and "data" in content["source"]
                        ):
                            print(
                                f"PDF data length: {len(content['source']['data'])}",
                                file=sys.stderr,
                            )
                            print(
                                f"PDF data starts with: {content['source']['data'][:100]}",
                                file=sys.stderr,
                            )
                            print(
                                f"PDF data ends with: {content['source']['data'][-100:]}",
                                file=sys.stderr,
                            )

        # Create a clean version of the request for logging (without the PDF data)
        log_kwargs = kwargs.copy()
        if "messages" in log_kwargs:
            log_messages = log_kwargs["messages"].copy()
            # Remove base64 PDF data from logged message
            for msg in log_messages:
                if isinstance(msg.get("content"), list):
                    for content in msg["content"]:
                        if content.get("type") == "document":
                            content["source"]["data"] = "<PDF_DATA_REMOVED>"
            log_kwargs["messages"] = log_messages

        model = kwargs.get("model", "unknown_model")

        # Make the actual API call
        try:
            response = func(*args, **kwargs)
            print("Anthropic call succeeded!", file=sys.stderr)
            return response
        except Exception as e:
            print(f"Anthropic call failed with error: {str(e)}", file=sys.stderr)
            raise

    return wrapper


# Initialize Anthropic client
anthropic = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


# Create a wrapped version of the messages endpoint
@log_anthropic_call
def anthropic_call(model: str, messages: list, max_tokens: int = 4096, **kwargs):
    # Remove any extra kwargs that might interfere
    kwargs.pop("headers", None)

    # Make the call exactly like the standalone example
    return anthropic.beta.messages.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        betas=["pdfs-2024-09-25"],
    )
