/**
 * POST /api/reschedule
 *
 * Body:
 * {
 *   "notificationToken": "...",
 *   "newDate": "25/09/2026 13:37",
 *   "shopName": "สาขาสยาม"
 * }
 */

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
    console.error(
      'LINE OAuth Error:',
      {
        status:
          response.status,

        data,
      }
    );

    throw new Error(
      data?.error_description ||
        data?.message ||
        'LINE OAuth failed'
    );
  }

  console.log(
    'LINE MINI App OAuth success:',
    {
      tokenType:
        data.token_type,

      expiresIn:
        data.expires_in,
    }
  );

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

  console.log(
    'LINE Token Verify:',
    {
      status:
        response.status,

      clientId:
        data?.client_id,

      expiresIn:
        data?.expires_in,
    }
  );

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        'Invalid channel access token'
    );
  }

  return data;
}


async function sendServiceMessage({
  accessToken,
  notificationToken,
  newDate,
  shopName,
}) {
  const url =
    'https://api.line.me/message/v3/notifier/send?target=service';

  const requestBody = {
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
  };

  console.log(
    'Sending LINE Service Message:',
    {
      templateName:
        requestBody.templateName,

      notificationTokenExists:
        Boolean(
          requestBody.notificationToken
        ),

      dateTime:
        newDate,

      shopName:
        shopName ||
        'สาขาหลัก',
    }
  );

  const response =
    await fetch(
      url,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: JSON.stringify(
          requestBody
        ),

        cache: 'no-store',
      }
    );

  const text =
    await response.text();

  let result;

  try {
    result =
      JSON.parse(text);
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

      statusText:
        response.statusText,

      result,
    }
  );

  if (!response.ok) {
    throw new Error(
      result?.message ||
        'LINE Service Message failed'
    );
  }

  return result;
}


export default async function handler(
  req,
  res
) {
  // ==========================================================
  // OPTIONS
  // ==========================================================

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
      'Content-Type'
    );

    return res
      .status(200)
      .end();
  }


  // ==========================================================
  // METHOD
  // ==========================================================

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({
        success: false,
        message:
          'Method Not Allowed',
      });
  }


  try {
    // ========================================================
    // ENV CHECK
    // ========================================================

    console.log(
      'LINE Environment:',
      {
        hasMiniAppChannelId:
          Boolean(
            process.env
              .LINE_MINIAPP_CHANNEL_ID
          ),

        hasMiniAppChannelSecret:
          Boolean(
            process.env
              .LINE_MINIAPP_CHANNEL_SECRET
          ),
      }
    );


    // ========================================================
    // REQUEST
    // ========================================================

    const {
      notificationToken,
      userId,
      newDate,
      shopName,
    } =
      req.body || {};


    // ========================================================
    // TARGET TOKEN
    // ========================================================

    const targetToken =
      notificationToken ||
      userId;


    // ========================================================
    // VALIDATION
    // ========================================================

    if (!targetToken) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            'Missing notificationToken',
        });
    }

    if (!newDate) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            'Missing newDate',
        });
    }


    // ========================================================
    // GET MINI APP CHANNEL TOKEN
    // ========================================================

    const accessToken =
      await getMiniAppChannelAccessToken();


    // ========================================================
    // VERIFY TOKEN
    // ========================================================

    const tokenInfo =
      await verifyChannelAccessToken(
        accessToken
      );


    // ========================================================
    // CHECK CHANNEL ID
    // ========================================================

    const configuredChannelId =
      process.env
        .LINE_MINIAPP_CHANNEL_ID;

    if (
      tokenInfo.client_id !==
      configuredChannelId
    ) {
      throw new Error(
        'LINE token belongs to a different channel'
      );
    }


    // ========================================================
    // SEND
    // ========================================================

    const result =
      await sendServiceMessage({
        accessToken,

        notificationToken:
          targetToken,

        newDate,

        shopName,
      });


    // ========================================================
    // SUCCESS
    // ========================================================

    return res
      .status(200)
      .json({
        success: true,

        data:
          result,
      });


  } catch (error) {
    console.error(
      'LINE API Error:',
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : 'Unknown error';

    return res
      .status(500)
      .json({
        success: false,

        error:
          message,
      });
  }
}