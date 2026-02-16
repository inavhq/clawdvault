/**
 * Twitter verification via SocialData.tools API
 *
 * Verifies a tweet exists, contains the expected claim code, and returns the author handle.
 * Falls back to stub behavior (extract handle from URL) if SOCIALDATA_API_KEY is not set.
 */

interface VerifyResult {
  verified: boolean;
  handle: string | null;
  error?: string;
}

/** Extract tweet ID from a twitter.com or x.com URL */
function extractTweetId(tweetUrl: string): string | null {
  const match = tweetUrl.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/);
  return match ? match[1] : null;
}

/** Extract handle from a twitter.com or x.com URL */
function extractHandle(tweetUrl: string): string | null {
  const match = tweetUrl.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status/);
  return match ? match[1] : null;
}

export async function verifyClaimTweet(
  tweetUrl: string,
  expectedClaimCode: string
): Promise<VerifyResult> {
  const apiKey = process.env.SOCIALDATA_API_KEY;

  // Require API key for verification
  if (!apiKey) {
    return { verified: false, handle: null, error: 'Twitter API key not configured' };
  }

  const tweetId = extractTweetId(tweetUrl);
  if (!tweetId) {
    return { verified: false, handle: null, error: 'Could not extract tweet ID from URL' };
  }

  try {
    const res = await fetch(`https://api.socialdata.tools/twitter/tweets/${tweetId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Twitter] SocialData API error ${res.status}:`, text);
      return {
        verified: false,
        handle: null,
        error: res.status === 404 ? 'Tweet not found' : 'Failed to fetch tweet',
      };
    }

    const tweet = await res.json();

    // Check tweet text contains the claim code
    const tweetText: string = tweet.tweet_text || tweet.full_text || tweet.text || '';
    if (!tweetText.includes(expectedClaimCode)) {
      return {
        verified: false,
        handle: null,
        error: `Tweet does not contain claim code "${expectedClaimCode}"`,
      };
    }

    // Extract author handle from response
    const handle: string | null =
      tweet.user?.screen_name || tweet.author?.screen_name || extractHandle(tweetUrl);

    return { verified: true, handle };
  } catch (err) {
    console.error('[Twitter] Verification error:', err);
    return {
      verified: false,
      handle: null,
      error: 'Failed to verify tweet (network error)',
    };
  }
}
