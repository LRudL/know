import json
from src.api.ai.prompts import BRAINSTORM_PROMPT, FINAL_PROMPT


def print_prompts_as_sql():
    prompts = {"brainstorm_prompt": BRAINSTORM_PROMPT, "final_prompt": FINAL_PROMPT}

    # Convert to JSON string with proper escaping
    json_str = json.dumps(prompts, indent=2)

    print(json_str)


if __name__ == "__main__":
    print_prompts_as_sql()
