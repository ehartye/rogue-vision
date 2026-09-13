const codes = { 37:'left',38:'up',39:'right',40:'down',13:'select',27:'back',8:'back',32:'select' };
const names = { ArrowLeft:'left',ArrowUp:'up',ArrowRight:'right',ArrowDown:'down',Enter:'select',Escape:'back',Backspace:'back',Space:'select',' ':'select' };
export function decodeKey(event) {
  return codes[event.keyCode] ?? names[event.code] ?? names[event.key] ?? null;
}
export function createInputFilter() {
  let previous=null, time=-Infinity;
  return (event, now=performance.now()) => {
    const action=decodeKey(event);
    if(!action || event.repeat) return null;
    if(action===previous && now-time<65) return null;
    previous=action;time=now;
    return action;
  };
}
