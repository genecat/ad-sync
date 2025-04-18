import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { listingId, frameId } = req.query;
  if (!listingId || !frameId) {
    return res.status(400).json({ error: 'Missing listingId or frameId' });
  }

  const { data: frameData, error: frameError } = await supabase
    .from('frames')
    .select('uploaded_file, campaign_id, price_per_click')
    .eq('listing_id', listingId)
    .eq('frame_id', frameId)
    .single();
  if (frameError || !frameData) {
    return res.status(404).json({ error: 'Ad not found' });
  }

  const campaignId = frameData.campaign_id;
  const imageUrl = frameData.uploaded_file;
  const pricePerClick = parseFloat(frameData.price_per_click) || 0.24;

  const { data: listingData, error: listingError } = await supabase
    .from('listings')
    .select('publisher_id')
    .eq('id', listingId)
    .single();
  if (listingError || !listingData) {
    return res.status(404).json({ error: 'Listing not found' });
  }
  const publisherId = listingData.publisher_id;

  const { data: campaignData, error: campaignError } = await supabase
    .from('campaigns')
    .select('campaign_details, clicks, impressions, budget, advertiser_id')
    .eq('id', campaignId)
    .single();
  if (campaignError || !campaignData) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const targetUrl = campaignData.campaign_details?.targetURL || 'https://mashdrop.com';
  const budget = parseFloat(campaignData.campaign_details?.budget) || 0;
  const endDate = campaignData.campaign_details?.endDate;
  const clicks = campaignData.clicks || 0;
  const impressions = campaignData.impressions || 0;
  const advertiserId = campaignData.advertiser_id;

  if (endDate) {
    const campaignEndDate = new Date(endDate.year, endDate.month - 1, endDate.day);
    const today = new Date();
    if (today > campaignEndDate) {
      return res.status(400).json({ error: 'Campaign has expired' });
    }
  }

  const totalSpent = clicks * pricePerClick;
  if (budget > 0 && totalSpent >= budget) {
    return res.status(400).json({ error: 'Campaign budget exhausted' });
  }

  const { error: impressionError } = await supabase
    .from('campaigns')
    .update({ impressions: impressions + 1 })
    .eq('id', campaignId);
  if (impressionError) {
    console.error('Error incrementing impression:', impressionError);
  }

  const { data: publisherStats, error: publisherStatsError } = await supabase
    .from('publishers')
    .select('total_impressions, total_clicks, total_earnings')
    .eq('id', publisherId)
    .single();

  let newImpressions = 1;
  let newClicks = 0;
  let newEarnings = 0;

  if (publisherStats) {
    newImpressions += publisherStats.total_impressions || 0;
    newClicks = publisherStats.total_clicks || 0;
    newEarnings = publisherStats.total_earnings || 0;
  }

  const { error: publisherUpdateError } = await supabase
    .from('publishers')
    .upsert({
      id: publisherId,
      total_impressions: newImpressions,
      total_clicks: newClicks,
      total_earnings: newEarnings
    }, { onConflict: 'id' });
  if (publisherUpdateError) {
    console.error('Error updating publisher stats:', publisherUpdateError);
  }

  const { data: advertiserStats, error: advertiserStatsError } = await supabase
    .from('advertisers')
    .select('total_impressions, total_clicks, total_spent')
    .eq('id', advertiserId)
    .single();

  let advImpressions = 1;
  let advClicks = clicks;
  let advSpent = totalSpent;

  if (advertiserStats) {
    advImpressions += advertiserStats.total_impressions || 0;
    advClicks = advertiserStats.total_clicks || 0;
    advSpent = advertiserStats.total_spent || 0;
  }

  const { error: advertiserUpdateError } = await supabase
    .from('advertisers')
    .upsert({
      id: advertiserId,
      total_impressions: advImpressions,
      total_clicks: advClicks,
      total_spent: advSpent
    }, { onConflict: 'id' });
  if (advertiserUpdateError) {
    console.error('Error updating advertiser stats:', advertiserUpdateError);
  }

  res.status(200).json({ imageUrl, targetUrl, listingId, frameId, campaignId });
};