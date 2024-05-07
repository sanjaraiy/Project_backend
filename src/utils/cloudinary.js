import {v2 as cloudinary} from 'cloudinary'
import fs from 'fs';



cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET, 
});

const uploadOnCloudinary = async (localFilePath) => {
    try {  
        // step 1 :- check for localfile Path (validation)
        if(!localFilePath) return null

        //step 2 :- upload the file on cloudinary
      const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
         
        //file has been uploaded successfull
        // console.log("file is uploaded on cloudinary",
        //     response.url
        // );

        // step 3 :- Remove the locally saved temporary file as the upload operation got successfully
        fs.unlinkSync(localFilePath)

        // step 4 :- Return the cloudinary generated response (eg. url)
        return response;

    } catch (error) {
        // step 5 :- Remove the locally saved temporary file as the upload operation got failed
        fs.unlinkSync(localFilePath)

        //step 6 :- Return the null uploaded operation failed on cloudinary
        return null;
    }
}


export {uploadOnCloudinary}


// cloudinary.uploader.upload("https://upload.wikimedia.org/wikipedia/commons/a/ae/Olympic_flag.jpg",
//   { public_id: "olympic_flag" }, 
//   function(error, result) {console.log(result); });
