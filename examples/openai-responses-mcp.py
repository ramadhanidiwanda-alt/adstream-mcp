from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-5.5",
    tools=[
        {
            "type": "mcp",
            "server_label": "adstream",
            "server_url": "https://mcp.example.com/mcp",
            "authorization": "Bearer YOUR_MCP_BEARER_TOKEN",
            "require_approval": "always",
            "allowed_tools": [
                "ads_get_account_performance",
                "ads_list_campaigns",
                "ads_get_campaign_performance",
            ],
        }
    ],
    input=(
        "Get Meta Ads account performance for act_your_ad_account_id "
        "from 2026-01-01 to 2026-06-24."
    ),
)

print(response.output_text)
