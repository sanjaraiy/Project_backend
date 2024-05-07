import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import {User} from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';


const generateAccessAndRefreshTokens = async (userId) => {
   try { 
      //step 1 :- find user in db by userId
      const user = await User.findById(userId);
      
      //step 2 :- generate accessToken and refreshToken using defined custom methods in userSchema
      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();
      
      //step 3 :- Store refreshToken in db
      user.refreshToken = refreshToken;
      await user.save({ validateBeforeSave: false});
      
      //step 4 :- return accessToken and refreshToken
      return {accessToken, refreshToken};

   } catch (error) {
       throw new ApiError(500,"Something went wrong while generating referesh and access token")
   }
}



const registerUser = asyncHandler(async (req,res)=>{
  
   // step 1 :- Get user details from frontend
   const {fullName, email, username, password}=req.body;

    // step 2 :- Validation - not empty
   if([fullName,email,username,password].some((field)=>field?.trim()==="")){
      throw new ApiError(400,"All fields are required");
   }
   
   // step 3 :- Check if user already exists : username, email
  const existedUser = await User.findOne({
    $or:[{username},{email}]
   })

   if(existedUser){
      throw new ApiError(409, "User with email or username already exists")
   }
  
 

   // step 4 :- Check for images, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  //   const coverImageLocalPath = req.files?.coverImage[0]?.path;
  
  let coverImageLocalPath;
  if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
     coverImageLocalPath = req.files.coverImage[0].path;
  }
 
  if(!avatarLocalPath){
     throw new ApiError(400,"Avatar file is required")
  }

  // step 5 :- Uplaod them to cloudinary (avatar, coverImage)
  const avatar = await uploadOnCloudinary(avatarLocalPath)
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  
  if(!avatar){
     throw new ApiError(400,"Avatar file is required")
  }
  
  // step 6 :- Create user object - create entry in db
  const user = await User.create({
    fullName,
    avatar:avatar.url,
    coverImage:coverImage?.url || "",
    email,
    password, 
    username:username.toLowerCase()
  })
   
 
   
  //step 7 :- Remove password and refresh token field from response
 const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
 )
  
 //step 8 :- Check for user creation
 if(!createdUser){
    throw new ApiError(500,"Something went wrong while register the user")
 }
  
 //step 9 :- Return res
 return res.status(201).json(
    new ApiResponse(200,createdUser,"User registered Successfully")
 )

})

const loginUser = asyncHandler(async (req,res)=>{
   //  step 1 :- Get data from frontend
   const {username, email, password} = req.body;
    
   // step 2 :- validated username, email, password - Not empty
    if(!(username || email)){
       throw new ApiError(400, "username or email is required");
    }
    
   // step 3 :- find and check the user in db
   const user = await User.findOne({
      $or:[{email},{username}]
   })

   if(!user){
      throw new ApiError(404,"User does not exist");
   }


   //step 4 :- check for password
   const isPasswordValid = await user.isPasswordCorrect(password);
   if(!isPasswordValid){
      throw new ApiError(401, "Invalid user credentials")
   }

   //step 5 :- generate the accessToken and referesh token
   const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id);

   //step 6 :- send cookie to the frontend
   const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
   const options = {
      httpOnly: true,
      secure: true,
   }
   
   return res
    .status(200)
    .cookie("accessToken", accessToken,options)
    .cookie("refreshToken", refreshToken, options)
    .json( new ApiResponse(200,{user : loggedInUser,accessToken,refreshToken}, "User logged In Successfully"))
})


const logoutUser = asyncHandler(async (req, res)=>{
   //step 1 :- get user_Id from frontend
   //step 2 :- find the user 
   //step 3 :- reset user stored refreshToken in db
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $set:{refreshToken: undefined}
      },
      {
         new : true
      }
   )


   //step 4 :- set the options
   const options  = {
      httpOnly : true,
      secure: true,
   }
   
   //step 5 :- clear the cookies from frontend and send response of logout status
   return res
   .status(200)
   .clearCookie("accessToken", options)
   .clearCookie("refreshToken", options)
   .json(new ApiResponse(200, {}, "User logged Out"))

})


const refreshAccessToken = asyncHandler(async (req, res)=>{
 try {
    //step 1 :- get the refreshToken from frontend
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    
    //step 2 :- Validate the incomingRefreshToken (-Not empty)
    if(!incomingRefreshToken){
       throw new ApiError(401, "unauthorized request");
    }
    
   //step 3 :- Decode the incomingRefreshToken
   const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
    
   //step 4 :- check for user by using userId in DecodedToken
   const user = await User.findById(decodedToken?._id);
   
   if(!user){
     throw new ApiError(401, "Invalid refresh token");
   }
  
   //step 5 :- check for incomingRefreshToken and stored refreshToken in db are equal
   if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401, "Refresh token is expired or used")
   }
   
   //step 6 :- generate new accessToken and refreshToken
   const options = {
     httpOnly : true,
     secure : true,
   }
   const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id);
  
   //step 7 :- send new generated accessToken and refreshToken
   return res
   .status(200)
   .cookie("accessToken", accessToken, options)
   .cookie("refreshToken", newRefreshToken, options)
   .json(
     new ApiResponse(200, {accessToken, refreshToken : newRefreshToken}, "Access token refreshed")
   )
 } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
 }
})


const changeCurrentPassword = asyncHandler(async(req,res)=>{
   //step 1 :- get the oldPassword, newPassword from frontend
   const {oldPassword, newPassword,confirmPassword} = req.body;
    
   // if(!(newPassword === confirmPassword)){

   // }
    
   //step 2 :- find the user by using user.Id
   const user = await User.findById(req.user?._id);
    
   //step 3 :- check for old password by using custom method defined in userSchema
   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
   
   if(!isPasswordCorrect){
      throw new ApiError(400, "Invalid old password");
   }
    
   //step 4 :- store new password in db
   user.password = newPassword
   await user.save({validateBeforeSave:false});
   
   //step 5 :- send the response to the frontend 
   return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed successfully"))

})


const getCurrentUser = asyncHandler(async(req,res)=>{
   //step 1 :- get user from req.user (already run auth-middleware and store userInfo in req.user)
   return res
    .status(200)
    .json(200, req.user, "current user fetched successfully")
})


const updateAccountDetails = asyncHandler(async(req, res)=>{
   // step 1 :- get fullname and email from frontend
   const {fullName, email} = req.body;

   // step 2 :- validate (not, empty)
   if(!fullName || !email){
      throw new ApiError(400, "All fields are required")
   }
  
   //step 3 :- find the user in db by using userId
   //step 4 :- update the fullname and email in db
   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set : {
            fullName,
            email: email
         }
      },
      {new: true}
   ).select("-password")

   //step 5 :- send the new userInfo to the frontend
   return res
     .status(200)
     .json(new ApiResponse(200, user, "Account details updated successfully"))
})


const updateUserAvatar = asyncHandler(async(req, res)=>{
   //step 1 :- get avatar path from middleware multer + req.file (frontend)
    const avatarLocalPath = req.file?.path;

   //step 2 :- validate (not, empty)
    if(!avatarLocalPath){
      throw new ApiError(400, "Avatar file is missing")
    }
   
   //step 3 :- avatar upload on cloudinary
   const avatar = await uploadOnCloudinary(avatarLocalPath);
   
   //step 4 :- check for cloudinary url getting 
   if(!avatar.url){
      throw new ApiError(400, "Error while uploading on avatar")
   }
   
   //step 5 :- find the user using userId and update the avatar url in db
   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set : {
            avatar : avatar.url
         }
      },
      { new : true}
   ).select("-password")
   
   //step 6 :- send reponse to the frontend 
   return res
      .status(200)
      .json(
         new ApiResponse(200, user, "Avatar updated successfully")
      )
})


const updateUserCoverImage = asyncHandler(async(req,res)=>{
   //step 1 :- get coverImage from multer + req.file (middleware) from frontend
    const coverImageLocalPath = req.file?.path;
    
   //step 2 :- validate (not, empty)
    if(!coverImageLocalPath){
      throw new ApiError(400, "CoverImage file is missing");
    }
   
   //step 3 :- upload the coverImage on cloudinary
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
   
   //step 4 :- check for cloudinary url getting
    if(!coverImage.url){
      throw new ApiError(400, "Error while uploading on coverImage");
    }
   
   //step 5 :- find user by using userId and update the coverImage in db
   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set : {
            coverImage : coverImage.url
         },
         
      },
      {
         new : true
      }
    ).select("-password")
   
   //step 6 :- send the response to the updated coverImage to the frontend
   return res
      .status(200)
      .json(
         new ApiResponse(200, user, "Cover image updated successfully")
      )

})


export {
   registerUser,
   loginUser,
   logoutUser,
   refreshAccessToken,
   changeCurrentPassword,
   getCurrentUser,
   updateAccountDetails,
   updateUserAvatar,
   updateUserCoverImage,
   
}