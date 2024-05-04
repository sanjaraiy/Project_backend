import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import {User} from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const registerUser = asyncHandler(async (req,res)=>{
  
   console.log("requested data :-\n",req);

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
  
   console.log("requested data files only :-\n",req.files);

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
   
  console.log("response of Created entry at DB :-\n",user);
   
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

export {registerUser}