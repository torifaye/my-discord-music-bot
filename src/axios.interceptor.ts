// import Axios from "axios";
// import FormData from "form-data";

// Axios.interceptors.request.use(async (req) => {
//     const payload = new FormData();
//     payload.append('grant_type', 'client_credentials');
//     const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`);

//     const res = await Axios.post(`https://accounts.spotify.com/api/token`, payload, {
//         headers: {
//             Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
//             'Content-Type': 'application/x-www-form-urlencoded'
//         }
//     });

//     req.headers.authorization = res.data["access_token"];
//     return req;
// })