/**
 * A stand-in `AdsProviderAdapter` for broker and registry tests.
 *
 * `AdsProviderAdapter` requires 40 methods. Tests that only exercise one or
 * two of them used to hand-roll a partial object and either declare it as the
 * interface (a type error) or `as`-cast it (which hides the next mismatch too),
 * so this fills every required method with a NOT_IMPLEMENTED responder and lets
 * the test override just what it drives.
 *
 * The methods are spelled out rather than generated from a name list on
 * purpose: when AdsProviderAdapter grows a method, this file stops compiling,
 * which is the signal that the stub no longer stands in for a real adapter.
 */
import type {
  AdsBrokerResponse,
  AdsProviderAdapter,
  AdsProviderId,
} from '../../src/broker/types.js';

export function providerAdapterStub(
  id: AdsProviderId,
  overrides: Partial<AdsProviderAdapter> = {}
): AdsProviderAdapter {
  const notImplemented = async <TData>(): Promise<AdsBrokerResponse<TData>> => ({
    ok: false,
    provider: id,
    errors: [
      {
        provider: id,
        code: 'NOT_IMPLEMENTED',
        message: `The ${id} test stub does not implement this operation`,
      },
    ],
  });

  return {
    id,
    displayName: `${id} stub`,
    capabilities: { providers: [id], categories: ['accounts'], operations: ['read'] },
    listAccounts: notImplemented,
    listCampaigns: notImplemented,
    getAccountPerformance: notImplemented,
    getCampaignPerformance: notImplemented,
    getAdsetOrAdgroupPerformance: notImplemented,
    getAdPerformance: notImplemented,
    getCreativePerformance: notImplemented,
    resolveCreativeAssets: notImplemented,
    getPlacementPerformance: notImplemented,
    getChangeHistory: notImplemented,
    getVideoSource: notImplemented,
    getAdCreativeMapping: notImplemented,
    getAdDestinations: notImplemented,
    readAdCreativeFull: notImplemented,
    readAdSetFull: notImplemented,
    pauseCampaign: notImplemented,
    resumeCampaign: notImplemented,
    updateCampaignBudget: notImplemented,
    renameCampaign: notImplemented,
    createCampaign: notImplemented,
    createAdSet: notImplemented,
    createAdCreative: notImplemented,
    createAd: notImplemented,
    cloneUiAd: notImplemented,
    archiveAd: notImplemented,
    pauseAd: notImplemented,
    resumeAd: notImplemented,
    pauseAdSet: notImplemented,
    resumeAdSet: notImplemented,
    cloneAdSet: notImplemented,
    updateAdSet: notImplemented,
    updateAd: notImplemented,
    updateCampaign: notImplemented,
    getTargetingOptions: notImplemented,
    createEcommerceCampaignBundle: notImplemented,
    uploadImage: notImplemented,
    uploadVideo: notImplemented,
    getAccountInfo: notImplemented,
    listAdImages: notImplemented,
    listAdVideos: notImplemented,
    getAdPreview: notImplemented,
    ...overrides,
  };
}
