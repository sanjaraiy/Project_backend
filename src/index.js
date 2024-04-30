// require('dotenv').config({path:"./env"})

import dotenv from "dotenv";
import connectDB from './db/connection.js';
import { app } from "./app.js";

dotenv.config({
    path:'./env'
})

//=============== DB connection =================
const port = process.env.PORT || 8000;
connectDB()
.then(()=>{

    app.on("error",(error)=>{
        console.log("ERROR: ",error);
        throw error
    })

    app.listen(port,()=>{
        console.log(`Server is running at port : ${port}`);
    })
})
.catch((error)=>{
    console.log("MONGO db connection failed !!!", error);
})









//IIF
// ;(async () => {
//     try {
//         await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
//         app.on("error",(error)=>{
//             console.log('ERROR:',error);
//             throw error;
//         })

//         app.listen(process.env.PORT, ()=>{
//             console.log(`App is listening on port ${process.env.PORT}`);
//         })

//     } catch (error) {
//         console.error("ERROR: ",error);
//         // throw error
//         // process.exit(1);
//     }
// })()