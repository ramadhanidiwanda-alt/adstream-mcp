/**
 * Instructions sent to every MCP client at initialize.
 *
 * This is the only guidance a remote client ever receives — the `skills/`
 * directory is invisible to agents that merely connect to the server. Keep it
 * short and procedural: cross-tool ordering, hard constraints, and how to
 * recover from an error. Do not restate what individual tool descriptions
 * already say.
 */
export interface ServerInstructionsOptions {
  writesEnabled: boolean;
}

const HEADER = `adstream-mcp is an ads execution layer for Meta Ads (Facebook/Instagram) and TikTok Ads.
It returns provider data and performs guarded writes. Reporting, auditing, and recommendations are
your job: call the data tools, then reason over the result yourself.`;

const WHEN_TO_USE = `WHEN TO USE THESE TOOLS
Reach for them whenever the user asks about ad spend, ROAS, CPA, campaign or creative performance,
audiences, pixels, catalogs, or wants to create, pause, or edit an ad on Meta or TikTok.
Call ads_list_accounts first when the ad account is not already known.
Call ads_get_capabilities when unsure whether a provider supports something before promising it.`;

const READ_WORKFLOW = `READING PERFORMANCE
Prefer ads_get_performance with an explicit level ("campaign", "adset", "ad", "creative"), a date
range, and explicit metrics. Always read the returned warnings, unsupportedMetrics, and dataFreshness
fields before stating a number as fact — a metric a provider does not support comes back empty, not
zero. For one entity's full configuration use ads_read_adset_full or ads_read_creative_full.`;

const CREATE_WORKFLOW = `CREATING A META CAMPAIGN OR AD — FOLLOW THIS ORDER
Most failures come from calling a create tool too early with guessed IDs. Do not guess IDs. Ever.

1. ads_check_launch_readiness FIRST, with the workflow that matches the user's goal
   (awareness, traffic_website, engagement_post, engagement_video, engagement_messaging,
   leads_website, leads_instant_form, app_installs, sales_website, sales_messaging, sales_catalog)
   plus whatever you already know. It returns "missing", "nextQuestions", and "recommendedTools".
   Treat that response as your checklist: it is the contract for what a valid create call needs.
2. Ask the user the questions from "nextQuestions", one at a time, in plain language.
   Do not expose raw API field names unless the user asks for them.
3. Resolve every ID with a discovery tool rather than asking the user to paste one:
   Page -> ads_list_pages | Pixel -> ads_list_pixels | Instagram -> ads_list_instagram_accounts
   WhatsApp -> ads_list_whatsapp_accounts then ads_list_whatsapp_phone_numbers
   Lead form -> ads_list_lead_forms | Catalog -> ads_list_catalogs then ads_list_product_sets
   Existing media -> ads_list_adimages, ads_list_advideos
   Existing campaigns -> ads_list_campaigns | Targeting values -> ads_get_targeting_options
4. For creative assets you may pass a local file path and let the tool upload it, or upload
   explicitly with ads_upload_image / ads_upload_video first.
5. Re-run ads_check_launch_readiness until it reports ready.
6. Run the create call as a dry run, summarize the plan for the user in plain language
   (goal, budget, destination, audience, creative, resulting status), and get explicit approval.
7. Only then execute. Everything is created PAUSED.
8. Verify with ads_get_ad_preview before suggesting the user activate anything.

Build the objects in order: ads_create_campaign -> ads_create_adset -> ads_create_adcreative ->
ads_create_ad. Use ads_create_ecommerce_campaign_bundle only when creating the whole set at once.`;

const WRITES_DISABLED = `WRITES ARE DISABLED ON THIS SERVER
Only read tools are registered. If the user asks to create, edit, pause, or archive anything, say so
plainly and stop — do not attempt a workaround. The operator enables writes by setting
ADSTREAM_ENABLE_WRITES=true on the server. You can still plan a launch and run
ads_check_launch_readiness to show the user exactly what the launch would need.`;

const HARD_RULES = `HARD RULES
- Never execute a write on the first message. Collect inputs, dry run, confirm, then execute.
- Everything is created PAUSED. Activating is a separate action needing its own explicit approval.
- Ask before any destructive or costly change: pause, archive, budget increase, budget cut over 50%.
- Never invent IDs, budgets, landing URLs, discounts, or compliance categories. Ask or discover them.
- If the offer touches credit, employment, housing, social issues, elections, or politics, set the
  correct special ad category instead of leaving it empty.
- Never reveal access tokens, connection keys, or authorization headers.`;

const ERROR_RECOVERY = `WHEN A CALL FAILS
Write errors come back structured. Read "actionableFix" and follow it — it names the concrete next
step. "providerSubcode" and "providerMessage" carry the real reason; the top-level message from the
provider is often just "Invalid parameter". Do not retry the identical payload, and do not silently
drop the failing field. If the fix needs an ID you do not have, go back to the discovery tool for it.
If two retries with a corrected payload still fail, stop and report the actionableFix to the user.`;

export function buildServerInstructions(options: ServerInstructionsOptions): string {
  const sections = [
    HEADER,
    WHEN_TO_USE,
    READ_WORKFLOW,
    options.writesEnabled ? CREATE_WORKFLOW : WRITES_DISABLED,
    HARD_RULES,
    ERROR_RECOVERY,
  ];

  return sections.join('\n\n');
}
