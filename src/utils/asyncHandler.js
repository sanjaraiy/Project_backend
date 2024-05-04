
//========= Method 1 ==============
const asyncHandler = (requestHandler) => {
 return (req,res,next) => {
      Promise.resolve(requestHandler(req,res,next)).catch((error) => next(error))
   }
}

export {asyncHandler}




// const asyncHandle = () => {}
// const asyncHandle = (func) => () => {}
// const asyncHandle = (func) => async () => {}


// =========== Method 2 ==================
// const asyncHandle = (fn) => async (req,res,next) => {
//     try {
//         await fn(req,res,next);
//     } catch (error) {
//         res.status(err.code || 500).json({
//             success:false,
//             message:err.message,
//         })
//     }
// }