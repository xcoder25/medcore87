import admin from 'firebase-admin';

const FALLBACK_SERVICE_ACCOUNT = {
  type: 'service_account',
  project_id: 'naija-bites-1s3y1',
  private_key_id: 'c0d0d599f6a7ff1e213ff88c724a6334c577c314',
  private_key:
    '-----BEGIN PRIVATE KEY-----\n' +
    'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCpcImRzS2A/Nv9\n' +
    'cjsg6t0vnYeC9TyXvTt3FRHgGskWQRl/upw5B6mGMG5bPfN8ZDql2LtksKwy/GQ7\n' +
    'r77RIZjujuRowd4tYhsA9dNot10XIG866tN7+9QisyCbOsMjroWkY1ffXFcjMMVG\n' +
    'PRdgj24pfWtL9Q/0+AkrkMzo27TPOhfzaBaz/tEevla7oVD8psGIZ7Kp1HEttjM0\n' +
    'HuZU837bT98MfbsHMXVKeGmAbxKQMyuxIy9i3CMd5TA8NwpKFIC0tf+aUWfz5aUx\n' +
    'XlKryOBIRBN1jtQ7xk4VWrBf0WjRXs3nyoAPT8DSVlLJfmJgMs2MVH5iqV0Kl5ry\n' +
    'ECIXoUtjAgMBAAECggEAA4+3fIaNAcyOzS10+7SkEIelnQWNj/zsvoyFUyoM9vhI\n' +
    'Umx4MySrlgP3ldhgAUnUB79d9PhXrjyq2KxRfPDRV5ZOS7tjcZ3BxovkNSvBe6Z1\n' +
    'YA4mgtEgvNf6A/lAt8PH0FQ8ORgmRrmUM+09zAxHuvyFYFPW0YXTH4TMIcrYapCb\n' +
    'vo4sBususwSy+gTSwRVWaf7V5sUICklX3IUENkcJxsjF/JvqXSa4zNrOH50I6Qsn\n' +
    'srtwcSQBHtH9AjHtNw9vl42kL4d2Y33n9gLU8FyeSRfoqP3VwGDhTIr8BykYZaB5\n' +
    'nAVVWwbk3VQI4OsC0uBiYJPZ6QvfrS9Yg/6qE+kSeQKBgQDh2lfQmBhOii5J/lio\n' +
    '4i8IyQiw64Ah6YnMXTm/3PxkCtuyvzTQY8pAicFQoBUBPzaG6yOINPMv4IvpvuEe\n' +
    'udgaaxh4K86fF/TuNAQyD70OLwxn144V7/S6yZ1FOoxwY6+j09f0TV8ZjESa5UUm\n' +
    'glxP5znbBBJ4gFODzKXzeakACQKBgQDADnxrcl8xm6TFtN13hcaFHS0IsWz4I6wk\n' +
    'VTLiBf8WA+xdG5b53Xaj34u06FBOcca0OCyYTAbSkE7OlhCd+dwycGnR7GSB4BEn\n' +
    'QTk+B6Ogt7TKBW0LkUzBxWo9fnObR4RgWFk/ZtSEqlnJjjLG/dt2IBccAFBS09sk\n' +
    '7aDOhZizCwKBgB0V+WkrrTWwJfXxg4l8V4JSIYRnT8EOSmi/OMi0tOxNWa3TYgHU\n' +
    'WB+nnfW8J/hZI7SMY68O4qKv0FTx+Bv04xfD4wrW2W0zsJ9co42u6TICbR6SbAH3\n' +
    'PRUxEcfwmlV/AQegKJeVv0GTBuLL0/P5pdnEdXb3N0m9fQPkPxrz+AfBAoGBAIRh\n' +
    'N8eD9TOnecLA8SpybizQuHrWeSrsw7njdAgxY+tT1vcyjjU6Po2kB5Mx0jDP4cvV\n' +
    'MH/lX4qB56Aj9d4+HFYz/+yviXOv84LgRUmJUHL2TUo2xTwE8ihaH+m1IJB2kjsq\n' +
    'ipHWGkQ7e1ofhsZ8smnQor0tRjBhURs6I+5WTbOTAoGAXJK6tiTJ/rCYaDgaKNVx\n' +
    'nJr20RWxiqzlvPaeEIajFe9eSfIk+x3NkjopNGqBjnu0hbD41mnli8lUW5EEBG6T\n' +
    '27lA23z242HW4JRZqYdkIIkVGGVxJoq9/N8z8aGSkyMjOFTjBbOkri4q3TJeEKop\n' +
    'KF4LrnRnP9Qnfcp/qjWbrVA=\n' +
    '-----END PRIVATE KEY-----\n',
  client_email: 'firebase-adminsdk-fbsvc@naija-bites-1s3y1.iam.gserviceaccount.com',
};

try {
  const app = admin.initializeApp({
    credential: admin.credential.cert(FALLBACK_SERVICE_ACCOUNT),
  });
  const auth = admin.auth(app);
  const users = await auth.listUsers(5);
  console.log('SUCCESS! Found', users.users.length, 'users:');
  users.users.forEach(u => console.log(' -', u.email, u.uid));
} catch (err) {
  console.error('FAILED TO CONNECT FIREBASE ADMIN:', err);
}
