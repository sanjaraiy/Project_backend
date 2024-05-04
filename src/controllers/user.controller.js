import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import {User} from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'josnwebtoken';


const generateAccessAndRefreshTokens = async (userId) => {
   try {
      const user = await User.findById(userId);

      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();

      user.refreshToken = refreshToken;
      await user.save({ validateBeforeSave: false});

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
    
   // step 2 :- validated username,email,password - Not empty
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
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $set:{refreshToken: undefined}
      },
      {
         new : true
      }
   )

   const options  = {
      httpOnly : true,
      secure: true,
   }

   return res
   .status(200)
   .clearCookie("accessToken", options)
   .clearCookie("refreshToken", options)
   .json(new ApiResponse(200, {}, "User logged Out"))

})

const refreshAccessToken = asyncHandler(async (req, res)=>{
 try {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
  
    if(incomingRefreshToken){
       throw new ApiError(401, "unauthorized request");
    }
  
   const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
  
   const user = await User.findById(decodedToken?._id);
  
   if(!user){
     throw new ApiError(401, "Invalid refresh token");
   }
  
   if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401, "Refresh token is expired or used")
   }
  
   const options = {
     httpOnly : true,
     secure : true,
   }
  
   const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id);
  
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

export {
   registerUser,
   loginUser,
   logoutUser,
   refreshAccessToken,
}