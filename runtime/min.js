/**
 * Copyright (c) 2014, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * https://raw.github.com/facebook/regenerator/master/LICENSE file. An
 * additional grant of patent rights can be found in the PATENTS file in
 * the same directory.
 */
(function(t,r,e){function n(t,r,e,n){return new o(t,r,e||null,n||[])}function o(t,r,n,o){function i(r,o){if(s===f)throw new Error("Generator is already running");if(s===p)throw new Error("Generator has already finished");for(;;){var i=l.delegate;if(i){try{var a=i.iterator[r](o);r="next",o=e}catch(c){l.delegate=null,r="throw",o=c;continue}if(!a.done)return s=h,a;l[i.resultName]=a.value,l.next=i.nextLoc,l.delegate=null}if("next"===r){if(s===u&&"undefined"!=typeof o)throw new TypeError("attempt to send "+JSON.stringify(o)+" to newborn generator");s===h?l.sent=o:delete l.sent}else if("throw"===r){if(s===u)throw s=p,o;l.dispatchException(o)&&(r="next",o=e)}s=f;try{var d=t.call(n,l);s=l.done?p:h;var a={value:d,done:l.done};if(d!==y)return a;l.delegate&&"next"===r&&(o=e)}catch(v){s=p,"next"===r?l.dispatchException(v):o=v}}}var a=r?Object.create(r.prototype):this,l=new c(o),s=u;return a.next=i.bind(a,"next"),a.throw=i.bind(a,"throw"),a}function i(t){var r={tryLoc:t[0]};1 in t&&(r.catchLoc=t[1]),2 in t&&(r.finallyLoc=t[2]),this.tryEntries.push(r)}function a(t,r){var e=t.completion||{};e.type=0===r?"normal":"return",delete e.arg,t.completion=e}function c(t){this.tryEntries=[{tryLoc:"root"}],t.forEach(i,this),this.reset()}function l(r){var e=r,n=t.Symbol;if(n&&n.iterator in r)e=r[n.iterator]();else if(!isNaN(r.length)){var o=-1;e=function i(){for(;++o<r.length;)if(o in r)return i.value=r[o],i.done=!1,i;return i.done=!0,i},e.next=e}return e}var s=Object.prototype.hasOwnProperty;if(!t.wrapGenerator){t.wrapGenerator=n,"undefined"!=typeof exports&&(exports.wrapGenerator=n);var u="suspendedStart",h="suspendedYield",f="executing",p="completed",y={},d=o.prototype,v=r.prototype=Object.create(Function.prototype);v.constructor=r,v.prototype=d,d.constructor=v,n.mark=function(t){return t.__proto__=v,t.prototype=Object.create(d),t},n.async=function(t,r,e){return new Promise(function(o,i){function a(t){try{var r=this(t),e=r.value}catch(n){return i(n)}r.done?o(e):Promise.resolve(e).then(l,s)}var c=n(t,r,e),l=a.bind(c.next),s=a.bind(c.throw);l()})},"GeneratorFunction"!==r.name&&(r.name="GeneratorFunction"),n.isGeneratorFunction=function(t){var e=t&&t.constructor;return e?r.name===e.name:!1},o.prototype.toString=function(){return"[object Generator]"},n.keys=function(t){var r=[];for(var e in t)r.push(e);return r.reverse(),function n(){for(;r.length;){var e=r.pop();if(e in t)return n.value=e,n.done=!1,n}return n.done=!0,n}},n.values=l,c.prototype={constructor:c,reset:function(){this.prev=0,this.next=0,this.sent=e,this.done=!1,this.delegate=null,this.tryEntries.forEach(a);for(var t,r=0;s.call(this,t="t"+r)||20>r;++r)this[t]=null},stop:function(){this.done=!0;var t=this.tryEntries[0],r=t.completion;if("throw"===r.type)throw r.arg;return this.rval},dispatchException:function(t){function r(r,n){return i.type="throw",i.arg=t,e.next=r,!!n}if(this.done)throw t;for(var e=this,n=this.tryEntries.length-1;n>=0;--n){var o=this.tryEntries[n],i=o.completion;if("root"===o.tryLoc)return r("end");if(o.tryLoc<=this.prev){var a=s.call(o,"catchLoc"),c=s.call(o,"finallyLoc");if(a&&c){if(this.prev<o.catchLoc)return r(o.catchLoc,!0);if(this.prev<o.finallyLoc)return r(o.finallyLoc)}else if(a){if(this.prev<o.catchLoc)return r(o.catchLoc,!0)}else{if(!c)throw new Error("try statement without catch or finally");if(this.prev<o.finallyLoc)return r(o.finallyLoc)}}}},_findFinallyEntry:function(t){for(var r=this.tryEntries.length-1;r>=0;--r){var e=this.tryEntries[r];if(e.tryLoc<=this.prev&&s.call(e,"finallyLoc")&&(e.finallyLoc===t||this.prev<e.finallyLoc))return e}},abrupt:function(t,r){var e=this._findFinallyEntry(),n=e?e.completion:{};return n.type=t,n.arg=r,e?this.next=e.finallyLoc:this.complete(n),y},complete:function(t){if("throw"===t.type)throw t.arg;return"break"===t.type||"continue"===t.type?this.next=t.arg:"return"===t.type&&(this.rval=t.arg,this.next="end"),y},finish:function(t){var r=this._findFinallyEntry(t);return this.complete(r.completion)},"catch":function(t){for(var r=this.tryEntries.length-1;r>=0;--r){var e=this.tryEntries[r];if(e.tryLoc===t){var n=e.completion;if("throw"===n.type){var o=n.arg;a(e,r)}return o}}throw new Error("illegal catch attempt")},delegateYield:function(t,r,e){return this.delegate={iterator:l(t),resultName:r,nextLoc:e},y}}}}).apply(this,Function("return [this, function GeneratorFunction(){}]")());