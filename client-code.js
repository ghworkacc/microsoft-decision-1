import MyClass from './src/MyClass.js';

console.log("Instantiating dependency");
const myClass = new MyClass();

const appDiv = document.getElementById("app")
appDiv.innerHTML = myClass.speak();

console.log("Finished consuming dependancy... " + myClass.speak());
