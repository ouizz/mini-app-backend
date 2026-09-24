async function getMiniAppChannelAccessToken() {
  const channelId =
    process.env.LINE_MINIAPP_CHANNEL_ID;

  const channelSecret =
    process.env.LINE_MINIAPP_CHANNEL_SECRET;

  if (!channelId) {
    throw new Error(
      'Missing LINE_MINIAPP_CHANNEL_ID'
    );
  }

  if (!channelSecret) {
    throw new Error(
      'Missing LINE_MINIAPP_CHANNEL_SECRET'
    );
  }

  const response = await fetch(
    'https://api.line.me/v2/oauth/accessToken',
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded',
      },

      body: new URLSearchParams({
        grant_type:
          'client_credentials',

        client_id:
          channelId,

        client_secret:
          channelSecret,
      }),

      cache: 'no-store',
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error_description ||
        data?.message ||
        'LINE OAuth failed'
    );
  }

  return data.access_token;
}


async function verifyChannelAccessToken(
  accessToken
) {
  const response = await fetch(
    'https://api.line.me/v2/oauth/verify',
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded',
      },

      body: new URLSearchParams({
        access_token:
          accessToken,
      }),

      cache: 'no-store',
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        'Invalid channel access token'
    );
  }

  return data;
}


async function issueServiceNotificationToken({
  channelAccessToken,
  liffAccessToken,
}) {
  if (!liffAccessToken) {
    throw new Error(
      'Missing LIFF access token'
    );
  }

  const response = await fetch(
    'https://api.line.me/message/v3/notifier/token',
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',

        Authorization:
          `Bearer ${channelAccessToken}`,
      },

      body: JSON.stringify({
        liffAccessToken,
      }),

      cache: 'no-store',
    }
  );

  const text =
    await response.text();

  let result;

  try {
    result = JSON.parse(text);
  } catch {
    result = {
      raw: text,
    };
  }

  console.log(
    'LINE Issue Notification Token:',
    {
      status:
        response.status,

      success:
        response.ok,

      hasNotificationToken:
        Boolean(
          result?.notificationToken
        ),

      expiresIn:
        result?.expiresIn,

      remainingCount:
        result?.remainingCount,

      sessionId:
        result?.sessionId,
    }
  );

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        'Failed to issue notification token'
    );
  }

  if (!result?.notificationToken) {
    throw new Error(
      'notificationToken was not returned'
    );
  }

  return result;
}


async function sendServiceMessage({
  channelAccessToken,
  notificationToken,
  newDate,
  shopName,
}) {
  if (!notificationToken) {
    throw new Error(
      'Missing service notification token'
    );
  }

  const response = await fetch(
    'https://api.line.me/message/v3/notifier/send?target=service',
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',

        Authorization:
          `Bearer ${channelAccessToken}`,
      },

      body: JSON.stringify({
        templateName:
          'accepted_reminder_d_th',

        notificationToken,

        params: {
          date_time:
            newDate,

          shop_name:
            shopName ||
            'สาขาหลัก',

          btn1_url:
            'https://miniapp.line.me/2011612068-jTYoURfr',

          btn2_url:
            'https://line.me',
        },
      }),

      cache: 'no-store',
    }
  );

  const text =
    await response.text();

  let result;

  try {
    result = JSON.parse(text);
  } catch {
    result = {
      raw: text,
    };
  }

  console.log(
    'LINE Service Message Response:',
    {
      status:
        response.status,

      success:
        response.ok,

      hasNewNotificationToken:
        Boolean(
          result?.notificationToken
        ),

      expiresIn:
        result?.expiresIn,

      remainingCount:
        result?.remainingCount,

      sessionId:
        result?.sessionId,
    }
  );

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        'LINE Service Message failed'
    );
  }

  return result;
}


export default async function handler(
  req,
  res
) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error:
        'Method Not Allowed',
    });
  }

  try {
    const {
      liffAccessToken,
      newDate,
      shopName,
    } = req.body || {};

    // --------------------------------------------------------
    // Validate
    // --------------------------------------------------------

    if (!liffAccessToken) {
      return res.status(400).json({
        success: false,
        error:
          'Missing liffAccessToken',
      });
    }

    if (!newDate) {
      return res.status(400).json({
        success: false,
        error:
          'Missing newDate',
      });
    }

    // --------------------------------------------------------
    // 1. Get Channel Access Token
    // --------------------------------------------------------

    const channelAccessToken =
      await getMiniAppChannelAccessToken();

    console.log(
      'LINE MINI App OAuth success'
    );

    // --------------------------------------------------------
    // 2. Verify Channel Access Token
    // --------------------------------------------------------

    const tokenInfo =
      await verifyChannelAccessToken(
        channelAccessToken
      );

    console.log(
      'LINE Token Verify:',
      {
        clientId:
          tokenInfo.client_id,

        expiresIn:
          tokenInfo.expires_in,
      }
    );

    // --------------------------------------------------------
    // 3. Verify channel ID
    // --------------------------------------------------------

    const configuredChannelId =
      process.env
        .LINE_MINIAPP_CHANNEL_ID;

    if (
      tokenInfo.client_id !==
      configuredChannelId
    ) {
      throw new Error(
        'Channel access token belongs to another channel'
      );
    }

    // --------------------------------------------------------
    // 4. Issue Service Notification Token
    // --------------------------------------------------------

    const notification =
      await issueServiceNotificationToken({
        channelAccessToken,

        liffAccessToken,
      });

    // --------------------------------------------------------
    // 5. Send Service Message
    // --------------------------------------------------------

    const result =
      await sendServiceMessage({
        channelAccessToken,

        notificationToken:
          notification.notificationToken,

        newDate,

        shopName,
      });

    // --------------------------------------------------------
    // 6. IMPORTANT
    // --------------------------------------------------------
    //
    // result.notificationToken
    // ต้องเอาไปเก็บ DB
    //
    // อย่าใช้ notification.notificationToken
    // สำหรับครั้งถัดไป
    //
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      data: {
        notificationToken:
          result.notificationToken,

        expiresIn:
          result.expiresIn,

        remainingCount:
          result.remainingCount,

        sessionId:
          result.sessionId,
      },
    });

  } catch (error) {
    console.error(
      'LINE API Error:',
      error
    );

    return res.status(500).json({
      success: false,

      error:
        error instanceof Error
          ? error.message
          : 'Unknown error',
    });
  }
}