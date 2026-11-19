/** Settle only on release; leaving the book is never a cancellation condition. */
export function turnDecision({distance,width,velocity,maxDistance}){
 if(maxDistance<8)return true;
 const progress=Math.max(0,distance/width);
 return progress>=.22||(progress>=.04&&velocity>=.45);
}
