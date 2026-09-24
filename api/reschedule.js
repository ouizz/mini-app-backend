export default async function handler(req, res) {
  // จัดการ Preflight Request (CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { userId, newDate, shopName } = req.body;

  if (!userId || !newDate) {
    return res.status(400).json({ error: 'Missing userId or newDate' });
  }

  const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  try {
    const lineResponse = await fetch('https://api.line.me/message/v3/notifier/send?target=service', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        templateName: 'accepted_reminder_d_th',
        params: {
          date_time: newDate,
          shop_name: shopName || 'สาขาหลัก',
          btn1_url: 'https://miniapp.line.me/2011612068-jTYoURfr',
          btn2_url: 'https://line.me'
        },
        notificationToken: userId
      })
    });

    const result = await lineResponse.json();

    if (!lineResponse.ok) {
      return res.status(lineResponse.status).json({ success: false, details: result });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}