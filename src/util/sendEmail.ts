import nodemailer from 'nodemailer';

// async..await is not allowed in global scope, must use a wrapper
export const sentEmail = async (to: string, html: string) => {
    // Generate test SMTP service account from ethereal.email
    // Only needed if you don't have a real mail account for testing

    // If the test account expires, uncomment this and get new credentials in the console
    // let testAccount = await nodemailer.createTestAccount();
    // console.log('test account', testAccount)

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: 'tvy74l5d7h3llyqs@ethereal.email',
            pass: 'ZTpgTrz9m5H99teyfu',
        },
    });

    let info = await transporter.sendMail({
        from: '"Fred Foo 👻" <foo@example.com>', // sender address
        to,
        subject: "Reset password",
        html
    });

    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
}
