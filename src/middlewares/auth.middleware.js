import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import jwt from 'jsonwebtoken';

const verifyJWT = asyncHandler(async (req, _, next)=>{
 try {  
    //  step 1 :- get accessToken from frontend
      const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    
    // step 2 :- validate token (Not, empty)
      if(!token){
          throw new ApiError(401, "Unauthorized request");
      }
     
    // step 3 :- decoded the incomingAccessToken
      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
     
    //step 4 :- check for user in db by using userId
      const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
      if(!user){
         throw new ApiError(401, "Invalid Access Token");
      }
      
    //step 5 :- store the user information from db into the req.user
      req.user = user;

    //step 6 :- call to the next middleware
      next()

 } catch (error) {
     throw new ApiError(401, error?.message || "Invalid access token") 
 }
})

export {verifyJWT}