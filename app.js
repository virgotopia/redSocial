var app = angular.module("myApp", ["ngRoute"]);
app.config(function($routeProvider) {
  $routeProvider
    .when("/", {
      templateUrl: "views/main.html"
    })
    .when("/login", {
      templateUrl: "views/login.html"
    })
    .when("/newPost", {
      templateUrl: "views/newPost.html"
    });
});
