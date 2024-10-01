// @ts-ignore: typescript doesn't know about our inline bundling system
// so we need to silence the error

import script from "./scripts/lightbox.inline"

export default (() => {
  function LightBox() {
}
 
 
  LightBox.afterDOMLoaded = script
  
  return LightBox
}) satisfies QuartzComponentConstructor
