import nodemailer from 'nodemailer'

// Email configuration
const transporter = nodemailer.createTransport({
  host: 'mail.spacemail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'no-reply@s7robotics.space',
    pass: '15862865Bb$'
  }
})

// Generate a verification code in format 6 digits
export function generateVerificationCode(): string {
  const chars = '0123456789'
  let code = ''
  
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  return code
}

// Send verification email
export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  const mailOptions = {
    from: 'no-reply@s7robotics.space',
    to: email,
    subject: 'Код подтверждения S7 Robotics',
    html: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Подтверждение почты</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background-color: #0a0a0a;
      color: #ffffff;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #0b0b0b;
      border: 1px dashed #1f1f1f;
      border-radius: 20px;
    }
    .header {
      text-align: center;
      padding: 20px 0;
    }
    .logo {
      max-width: 120px;
      height: auto;
      margin: 0 auto;
      display: block;
    }
    .content {
      padding: 20px 0;
    }
    .code {
      font-size: 32px;
      font-weight: bold;
      text-align: center;
      letter-spacing: 5px;
      color: #F3E6A2;
      margin: 30px 0;
      padding: 20px;
      background-color: #121212;
      border: 1px dashed #1f1f1f;
      border-radius: 10px;
    }
    .footer {
      text-align: center;
      padding: 20px 0;
      color: #a7a7a7;
      font-size: 14px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #F3E6A2;
      color: #000000;
      text-decoration: none;
      border-radius: 999px;
      font-weight: bold;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://s7robotics.space/logo-s7.png" alt="S7 Robotics Logo" class="logo">
      <h1>Подтверждение почты</h1>
    </div>
    <div class="content">
      <p>Здравствуйте!</p>
      <p>Для завершения входа в систему S7 Robotics, пожалуйста, введите следующий код подтверждения:</p>
      <div class="code">${code}</div>
      <p>Если вы не запрашивали этот код, просто проигнорируйте это сообщение.</p>
    </div>
    <div class="footer">
      <p>© 2025 S7 Robotics. Все права защищены.</p>
    </div>
  </div>
</body>
</html>`
  }

  await transporter.sendMail(mailOptions)
}

// Send certificate email with attachment
export async function sendCertificateEmail(email: string, fullName: string, courseName: string, certificateBuffer: Buffer): Promise<void> {
  const mailOptions = {
    from: 'no-reply@s7robotics.space',
    to: email,
    subject: 'Поздравляем! Вы получили сертификат S7 Robotics',
    html: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Сертификат S7 Robotics</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background-color: #0a0a0a;
      color: #ffffff;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #0b0b0b;
      border: 1px dashed #1f1f1f;
      border-radius: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      width: 150px;
      height: auto;
      margin-bottom: 20px;
    }
    .content {
      padding: 20px 0;
    }
    .certificate-info {
      background-color: #1a1a1a;
      padding: 20px;
      border-radius: 10px;
      margin: 20px 0;
      text-align: center;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #333;
      color: #888;
      font-size: 14px;
    }
    .highlight {
      color: #00ff88;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://s7robotics.space/logo-s7.png" alt="S7 Robotics Logo" class="logo">
      <h1>Поздравляем!</h1>
    </div>
    <div class="content">
      <p>Уважаемый(ая) <span class="highlight">${fullName}</span>,</p>
      <p>Мы рады сообщить вам, что вы успешно завершили программу <span class="highlight">"${courseName}"</span> и получили сертификат!</p>
      <div class="certificate-info">
        <p>Ваш сертификат прикреплен к этому письму.</p>
        <p>Вы можете распечатать его или сохранить для своих записей.</p>
      </div>
      <p>Поздравляем с достижением! Продолжайте в том же духе и развивайте свои навыки вместе с S7 Robotics.</p>
    </div>
    <div class="footer">
      <p>© 2025 S7 Robotics. Все права защищены.</p>
    </div>
  </div>
</body>
</html>`,
    attachments: [
      {
        filename: `certificate-${fullName.replace(/\s+/g, '-')}-${Date.now()}.png`,
        content: certificateBuffer,
        contentType: 'image/png'
      }
    ]
  }

  await transporter.sendMail(mailOptions)
}

// Send password reset email
export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  const mailOptions = {
    from: 'no-reply@s7robotics.space',
    to: email,
    subject: 'Сброс пароля S7 Robotics',
    html: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Сброс пароля</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background-color: #0a0a0a;
      color: #ffffff;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #0b0b0b;
      border: 1px dashed #1f1f1f;
      border-radius: 20px;
    }
    .header {
      text-align: center;
      padding: 20px 0;
    }
    .logo {
      max-width: 120px;
      height: auto;
      margin: 0 auto;
      display: block;
    }
    .content {
      padding: 20px 0;
    }
    .code {
      font-size: 32px;
      font-weight: bold;
      text-align: center;
      letter-spacing: 5px;
      color: #F3E6A2;
      margin: 30px 0;
      padding: 20px;
      background-color: #121212;
      border: 1px dashed #1f1f1f;
      border-radius: 10px;
    }
    .footer {
      text-align: center;
      padding: 20px 0;
      color: #a7a7a7;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://s7robotics.space/logo-s7.png" alt="S7 Robotics Logo" class="logo">
      <h1>Сброс пароля</h1>
    </div>
    <div class="content">
      <p>Здравствуйте!</p>
      <p>Вы запросили сброс пароля для аккаунта S7 Robotics. Используйте следующий код для сброса пароля:</p>
      <div class="code">${code}</div>
      <p>Если вы не запрашивали сброс пароля, просто проигнорируйте это сообщение.</p>
    </div>
    <div class="footer">
      <p>© 2025 S7 Robotics. Все права защищены.</p>
    </div>
  </div>
</body>
</html>`
  }

  await transporter.sendMail(mailOptions)
}


function formatDateRu(value: Date | string | undefined | null) {
  if (!value) return ""
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("ru-RU")
}

export async function sendEnrollmentApprovedParentEmail(params: {
  email?: string
  parentName: string
  planTitle: string
  students: string[]
  schedule?: string
  contactPhone: string
  amount: number
  startDate?: Date
  endDate?: Date
}): Promise<void> {
  if (!params.email) return
  const amountLabel = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(params.amount || 0)
  const studentsLabel = (params.students || []).filter(Boolean).join(", ") || "ученики"
  const scheduleLine = params.schedule ? `<p><strong>Расписание:</strong> ${params.schedule}</p>` : ""
  const periodLine = params.startDate && params.endDate
    ? `<p><strong>Период:</strong> ${formatDateRu(params.startDate)} – ${formatDateRu(params.endDate)}</p>`
    : ""

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Оплата подтверждена</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; background-color: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0b0b0b; border: 1px dashed #1f1f1f; border-radius: 20px; }
    .title { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
    .block { background-color: #121212; border: 1px dashed #1f1f1f; padding: 16px; border-radius: 12px; margin: 16px 0; }
    .muted { color: #a7a7a7; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="title">Оплата подтверждена</div>
    <p>Здравствуйте, ${params.parentName}!</p>
    <p>Оплата по абонементу «${params.planTitle}» успешно подтверждена.</p>
    <div class="block">
      <p><strong>Ученики:</strong> ${studentsLabel}</p>
      <p><strong>Сумма:</strong> ${amountLabel} тг</p>
      ${periodLine}
      ${scheduleLine}
    </div>
    <p>Ваши ученики записаны на занятия. Если остались вопросы, напишите или позвоните: ${params.contactPhone}.</p>
    <p class="muted">S7 Robotics</p>
  </div>
</body>
</html>`

  await transporter.sendMail({
    from: 'no-reply@s7robotics.space',
    to: params.email,
    subject: 'Оплата подтверждена — S7 Robotics',
    html
  })
}

export async function sendEnrollmentApprovedStudentEmail(params: {
  email?: string
  studentName: string
  parentName: string
  planTitle: string
  className?: string
  mentorName?: string
  schedule?: string
  contactPhone: string
}): Promise<void> {
  if (!params.email) return
  const classLine = params.className ? `<p><strong>Класс:</strong> ${params.className}</p>` : ""
  const scheduleLine = params.schedule ? `<p><strong>Расписание:</strong> ${params.schedule}</p>` : ""
  const mentorLine = params.mentorName ? `<p><strong>Ментор:</strong> ${params.mentorName}</p>` : ""
  const parentLabel = params.parentName || "Ваш родитель"

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ты записан(а) на занятия</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; background-color: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0b0b0b; border: 1px dashed #1f1f1f; border-radius: 20px; }
    .title { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
    .block { background-color: #121212; border: 1px dashed #1f1f1f; padding: 16px; border-radius: 12px; margin: 16px 0; }
    .muted { color: #a7a7a7; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="title">Ты записан(а) на занятия</div>
    <p>Привет, ${params.studentName}!</p>
    <p>${parentLabel} записал(а) тебя на «${params.planTitle}».</p>
    <div class="block">
      ${classLine}
      ${scheduleLine}
      ${mentorLine}
    </div>
    <p>Ждём тебя на занятиях. Если есть вопросы, позвоните: ${params.contactPhone}.</p>
    <p class="muted">S7 Robotics</p>
  </div>
</body>
</html>`

  await transporter.sendMail({
    from: 'no-reply@s7robotics.space',
    to: params.email,
    subject: 'Ты записан(а) на занятия — S7 Robotics',
    html
  })
}
