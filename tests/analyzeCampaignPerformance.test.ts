import { describe, it, expect } from 'vitest';
import { analyzeCampaignPerformance } from '../src/analysis/analyzeCampaignPerformance.js';
import type { CampaignInsight } from '../src/types.js';

describe('analyzeCampaignPerformance', () => {
  it('should identify warning status for high spend with low CTR', () => {
    const insights: CampaignInsight[] = [
      {
        campaign_id: '123',
        campaign_name: 'Test Campaign',
        spend: '150000',
        impressions: '100000',
        reach: '80000',
        clicks: '500',
        inline_link_clicks: '400',
        ctr: '0.5',
        cpc: '300',
        cpm: '1500',
      },
    ];

    const result = analyzeCampaignPerformance(insights);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('warning');
    expect(result[0].recommendation).toBe('fix_creative');
  });

  it('should identify good status for high CTR and reasonable CPC', () => {
    const insights: CampaignInsight[] = [
      {
        campaign_id: '456',
        campaign_name: 'Good Campaign',
        spend: '50000',
        impressions: '100000',
        reach: '80000',
        clicks: '2000',
        inline_link_clicks: '1800',
        ctr: '2.0',
        cpc: '25',
        cpm: '500',
      },
    ];

    const result = analyzeCampaignPerformance(insights);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('good');
    expect(result[0].recommendation).toBe('scale');
  });

  it('should identify watch status for low spend campaigns', () => {
    const insights: CampaignInsight[] = [
      {
        campaign_id: '789',
        campaign_name: 'New Campaign',
        spend: '5000',
        impressions: '10000',
        reach: '8000',
        clicks: '100',
        inline_link_clicks: '90',
        ctr: '1.0',
        cpc: '50',
        cpm: '500',
      },
    ];

    const result = analyzeCampaignPerformance(insights);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('watch');
    expect(result[0].recommendation).toBe('hold');
  });

  it('should identify good status when campaign has purchases', () => {
    const insights: CampaignInsight[] = [
      {
        campaign_id: '999',
        campaign_name: 'Purchase Campaign',
        spend: '30000',
        impressions: '50000',
        reach: '40000',
        clicks: '500',
        inline_link_clicks: '450',
        ctr: '1.0',
        cpc: '60',
        cpm: '600',
        actions: [
          { action_type: 'purchase', value: '10' },
          { action_type: 'add_to_cart', value: '25' },
        ],
      },
    ];

    const result = analyzeCampaignPerformance(insights);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('good');
    expect(result[0].purchases).toBe(10);
  });
});
