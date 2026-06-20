import { describe, it, expect, vi, beforeEach } from 'vitest';
import { previewCampaignMutation, executeCampaignMutation } from '../src/tools/campaignMutations.js';
import type { MetaClient } from '../src/metaClient.js';

function createMockClient(override?: Partial<MetaClient>): MetaClient {
  return {
    metaPost: vi.fn(),
    metaGet: vi.fn(),
    lastRateLimitInfo: null,
    ...override,
  } as unknown as MetaClient;
}

describe('campaignMutations', () => {
  describe('previewCampaignMutation', () => {
    it('should return preview with before/after for pause', async () => {
      const client = createMockClient();
      (client.metaGet as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ name: 'Test Campaign', status: 'ACTIVE', daily_budget: '50000' }],
      });

      const preview = await previewCampaignMutation(client, 'pause', '120248446250030168', {});

      expect(preview.operation).toBe('pause');
      expect(preview.status).toBe('dry_run');
      expect(preview.fields.status).toEqual({ old: 'ACTIVE', new: 'PAUSED' });
      expect(preview.before?.name).toBe('Test Campaign');
    });

    it('should return preview for update_budget', async () => {
      const client = createMockClient();
      (client.metaGet as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ name: 'Test', status: 'ACTIVE', daily_budget: '50000' }],
      });

      const preview = await previewCampaignMutation(client, 'update_budget', '120248446250030168', {
        dailyBudget: 100000,
      });

      expect(preview.operation).toBe('update_budget');
      expect(preview.fields.daily_budget).toEqual({ old: 50000, new: 100000 });
    });

    it('should return preview for rename', async () => {
      const client = createMockClient();
      (client.metaGet as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ name: 'Old Name', status: 'ACTIVE' }],
      });

      const preview = await previewCampaignMutation(client, 'rename', '120248446250030168', {
        newName: 'New Name',
      });

      expect(preview.operation).toBe('rename');
      expect(preview.fields.name).toEqual({ old: 'Old Name', new: 'New Name' });
    });
  });

  describe('executeCampaignMutation', () => {
    it('should return preview only when dryRun=true', async () => {
      const client = createMockClient();
      (client.metaGet as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ name: 'Test', status: 'ACTIVE' }],
      });

      const result = await executeCampaignMutation(
        client,
        'pause',
        '120248446250030168',
        {},
        { dryRun: true }
      );

      expect(result.executed).toBe(false);
      expect(result.preview.status).toBe('dry_run');
      expect(result.result).toBeUndefined();
    });

    it('should execute mutation when dryRun=false', async () => {
      const client = createMockClient();
      (client.metaGet as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ name: 'Test', status: 'ACTIVE' }],
      });
      (client.metaPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      const result = await executeCampaignMutation(
        client,
        'pause',
        '120248446250030168',
        {},
        { dryRun: false }
      );

      expect(result.executed).toBe(true);
      expect(result.preview.status).toBe('executed');
      expect(result.result?.success).toBe(true);
    });

    it('should handle execution error gracefully', async () => {
      const client = createMockClient();
      (client.metaGet as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ name: 'Test', status: 'ACTIVE' }],
      });
      (client.metaPost as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

      const result = await executeCampaignMutation(
        client,
        'pause',
        '120248446250030168',
        {},
        { dryRun: false }
      );

      expect(result.executed).toBe(false);
      expect(result.error).toBe('API error');
      expect(result.preview.status).toBe('failed');
    });

    it('should reject unknown operation', async () => {
      const client = createMockClient();
      (client.metaGet as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ name: 'Test', status: 'ACTIVE' }],
      });

      const result = await executeCampaignMutation(
        client,
        'unknown_operation' as MutationOperation,
        '120248446250030168',
        {},
        { dryRun: false }
      );

      expect(result.executed).toBe(false);
      expect(result.error).toBe('Unknown operation: unknown_operation');
    });
  });
});
