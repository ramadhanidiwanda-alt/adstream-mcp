# Ads Manager label → Marketing API field

Ads Manager UI labels frequently have no matching API field name. Searching the
Marketing API docs for a UI label is often a dead end. Use this table instead.

API version baseline: v25.0.

## Audience segments / customer lifecycle

| Ads Manager (ID)                                                         | Ads Manager (EN)                                     | Level      | API field                                           | Status                                                                                                                                             |
| ------------------------------------------------------------------------ | ---------------------------------------------------- | ---------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segmen pemirsa (pengaturan Periklanan)                                   | Audience segments (Advertising settings)             | Ad account | `existing_customers` — array of custom audience IDs | Read supported via `ads_get_account_info`. Write not supported here; configure in Ads Manager.                                                     |
| Pelaporan segmen pemirsa                                                 | Audience segment reporting                           | Campaign   | No documented field or insights breakdown           | Not available via API. Reporting surfaces in Ads Manager.                                                                                          |
| Strategi siklus hidup pelanggan → batasi budget pelanggan lama           | Customer lifecycle → limit existing-customer budget  | Ad set     | `existing_customer_budget_percentage`               | **Deprecated.** Unavailable for new Advantage+ campaigns; campaigns using it are paused at v26.0 and cannot be migrated via API. Do not implement. |
| Strategi siklus hidup pelanggan → prioritaskan pelanggan bernilai tinggi | Customer lifecycle → prioritize high-value customers | Ad set     | `optimization_goal=VALUE` + `bid_strategy`          | Supported.                                                                                                                                         |

### Replacing `existing_customer_budget_percentage`

Meta's documented replacement is a two-ad-set split, both supported by this repo:

1. Ad set A — `targeting.customAudiences` = the existing-customer audience.
2. Ad set B — `targeting.excludedCustomAudiences` = the same audience.
3. Split spend with `dailySpendCap` / `dailyMinSpendTarget` (or the `lifetime*`
   variants, which require a campaign lifetime budget) on each ad set.

Get the audience IDs from `ads_get_account_info` → `existing_customers`.

### Prioritizing high-value customers

```
ads_create_adset:
  optimizationGoal: "VALUE"
  promotedObject: { pixel_id: "<PIXEL_ID>", custom_event_type: "PURCHASE" }
  bidStrategy: "LOWEST_COST_WITH_MIN_ROAS"
  bidConstraints: { roas_average_floor: 20000 }   # 2.0x ROAS — value is ROAS × 10000
```

`LOWEST_COST_WITHOUT_CAP` with `optimizationGoal: "VALUE"` shows as "Highest Value"
in Ads Manager. `VALUE` requires the Website conversion location and a pixel with
`custom_event_type: PURCHASE`.

## Spend controls

| Ads Manager (ID)                    | Ads Manager (EN)              | Level  | API field                   | Tool param               |
| ----------------------------------- | ----------------------------- | ------ | --------------------------- | ------------------------ |
| Batas belanja harian                | Daily spend cap               | Ad set | `daily_spend_cap`           | `dailySpendCap`          |
| Target belanja minimum harian       | Daily minimum spend target    | Ad set | `daily_min_spend_target`    | `dailyMinSpendTarget`    |
| Batas belanja seumur hidup          | Lifetime spend cap            | Ad set | `lifetime_spend_cap`        | `lifetimeSpendCap`       |
| Target belanja minimum seumur hidup | Lifetime minimum spend target | Ad set | `lifetime_min_spend_target` | `lifetimeMinSpendTarget` |

All values are in account currency minor units. The `lifetime*` fields require a
lifetime budget on the campaign. Minimum spend targets are best-effort, not guaranteed.
