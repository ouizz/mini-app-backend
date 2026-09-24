/**
 * LINE Service Message API
 *
 * POST /api/line/send-service-message
 *
 * Body:
 * {
 *   "userId": "Uxxxxxxxxxxxx",
 *   "notificationToken": "xxxxxxxxxxxx",
 *   "newDate": "28/09/2026 10:00",
 *   "shopName": "สาขาหลัก"
 * }
 */

// ============================================================
// LINE OAuth 2.0
// ============================================================

async function getAccessToken() {
  const channelId = process.env.LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!channelId) {
    throw new Error('Missing LINE_CHANNEL_ID');
  }

  if (!channelSecret) {
    throw new Error('Missing LINE_CHANNEL_SECRET');
  }

  const response = await fetch(
    'https://api.line.me/v2/oauth/accessToken',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },

      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: channelId,
        client_secret: channelSecret,
      }),

      // ป้องกัน cache
      cache: 'no-store',
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error('LINE OAuth Error:', {
      status: response.status,
      statusText: response.statusText,
      data,
    });

    throw new Error(
      data?.error_description ||
        data?.message ||
        'LINE OAuth Failed'
    );
  }

  if (!data?.access_token) {
    throw new Error(
      'LINE OAuth response does not contain access_token'
    );
  }

  console.log('LINE OAuth success:', {
    tokenType: data.token_type,
    expiresIn: data.expires_in,
  });

  return data.access_token;
}

// ============================================================
// LINE Service Message
// ============================================================

async function sendServiceMessage({
  accessToken,
  notificationToken,
  newDate,
  shopName,
}) {
  const url =
    'https://api.line.me/message/v3/notifier/send?target=service';

  const body = {
    templateName: 'accepted_reminder_d_th',

    params: {
      date_time: newDate,

      shop_name: shopName || 'สาขาหลัก',

      btn1_url:
        'https://miniapp.line.me/2011612068-jTYoURfr',

      btn2_url:
        'https://line.me',
    },

    notificationToken,
  };

  console.log('Sending LINE Service Message:', {
    url,
    templateName: body.templateName,
    notificationTokenExists: Boolean(notificationToken),
    dateTime: newDate,
    shopName: shopName || 'สาขาหลัก',
  });

  const response = await fetch(url, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',

      Authorization: `Bearer ${accessToken}`,
    },

    body: JSON.stringify(body),

    cache: 'no-store',
  });

  const text = await response.text();

  let result;

  try {
    result = JSON.parse(text);
  } catch {
    result = {
      raw: text,
    };
  }

  if (!response.ok) {
    console.error('LINE Service Message Error:', {
      status: response.status,
      statusText: response.statusText,
      result,
    });

    throw new Error(
      result?.message ||
        result?.error_description ||
        result?.error ||
        'LINE Service Message API Failed'
    );
  }

  return result;
}

// ============================================================
// API Handler
// ============================================================

export default async function handler(req, res) {
  // ----------------------------------------------------------
  // CORS / Preflight
  // ----------------------------------------------------------

  if (req.method === 'OPTIONS') {
    res.setHeader(
      'Access-Control-Allow-Origin',
      '*'
    );

    res.setHeader(
      'Access-Control-Allow-Methods',
      'POST, OPTIONS'
    );

    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );

    return res.status(200).end();
  }

  // ----------------------------------------------------------
  // Method validation
  // ----------------------------------------------------------

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method Not Allowed',
    });
  }

  try {
    // --------------------------------------------------------
    // Environment validation
    // --------------------------------------------------------

    const hasChannelId =
      Boolean(process.env.LINE_CHANNEL_ID);

    const hasChannelSecret =
      Boolean(process.env.LINE_CHANNEL_SECRET);

    console.log('LINE Environment:', {
      hasChannelId,
      hasChannelSecret,
    });

    if (!hasChannelId || !hasChannelSecret) {
      return res.status(500).json({
        success: false,
        error:
          'LINE_CHANNEL_ID or LINE_CHANNEL_SECRET is missing',
      });
    }

    // --------------------------------------------------------
    // Request body
    // --------------------------------------------------------

    const {
      userId,
      notificationToken,
      newDate,
      shopName,
    } = req.body || {};

    // --------------------------------------------------------
    // Target
    // --------------------------------------------------------

    const targetToken =
      notificationToken || userId;

    // --------------------------------------------------------
    // Validation
    // --------------------------------------------------------

    if (!targetToken) {
      return res.status(400).json({
        success: false,
        error:
          'Missing notificationToken or userId',
      });
    }

    if (!newDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing newDate',
      });
    }

    // --------------------------------------------------------
    // Get OAuth Access Token
    // --------------------------------------------------------

    const accessToken = await getAccessToken();

    // --------------------------------------------------------
    // Send LINE Service Message
    // --------------------------------------------------------

    const result = await sendServiceMessage({
      accessToken,
      notificationToken: targetToken,
      newDate,
      shopName,
    });

    // --------------------------------------------------------
    // Success
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      data: result,
    });
  } catch (error) {
    console.error('LINE API Error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Unknown error';

    return res.status(500).json({
      success: false,

      error: message,
    });
  }
}