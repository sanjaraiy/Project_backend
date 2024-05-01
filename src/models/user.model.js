import mongoose,{Schema,model} from "mongoose";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';


const userSchema = new Schema({
    fullName : {
        type:String,
        required:true,
        trim:true,
        index:true,
    },
    email : {
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
    },
    password : {
        type:String, //hashing password
        required:[true,'Password is required'],
    },
    username : {
        type:String,
        required:true,
        unique:true,
        lowercase : true,
        trim : true,
        index:true,
    },
    avatar : {
        type:String, //cloudinary url
        required:true,
    },
    coverImage : {
        type:String, //cloudinary url
        
    },
    watchHistory : [
        {
            type : mongoose.Schema.Types.ObjectId,
            ref : "Video"
        }
    ],
    refreshToken:{
        type:String,
    }

},{timestamps:true})


//Imp :- 
//====Arrow can't use it because it doen't have reference of this in userSchema so, can't be manipulated directly inside the userSchema context=====
userSchema.pre("save",async function(next){
    if(!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password,10);
    next();
})

userSchema.methods.isPasswordCorrect = async function(password){
  return await bcrypt.compare(password,this.password);
}

userSchema.methods.generateAccessToken = function (){
   return jwt.sign({
        _id:this._id,
        email:this.email,
        username:this.username,
        fullName:this.fullName
    },process.env.ACCESS_TOKEN_SECRET,{
        expiresIn:process.env.ACCESS_TOKEN_EXPIRY
    }
)     
}
userSchema.methods.generateRefreshToken = function (){
    return jwt.sign({
        _id:this._id,
       },process.env.REFRESH_TOKEN_SECRET,{
        expiresIn:process.env.REFRESH_TOKEN_EXPIRY
    }
)     
}


const User = model("User",userSchema)

export {User}
