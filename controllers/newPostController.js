// Adapted after https://github.com/firebase/quickstart-js/tree/master/database

app.controller("newPostCtrl", function($scope) {
  var messageForm = document.getElementById("message-form");
  var messageInput = document.getElementById("new-post-message");
  var titleInput = document.getElementById("new-post-title");
  var addPost = document.getElementById("add-post");
  var listeningFirebaseRefs = [];

  function init() {
    // Listen for auth state changes
    firebase.auth().onAuthStateChanged(onAuthStateChanged);

    // Saves message on form submit.
    messageForm.onsubmit = function(e) {
      e.preventDefault();
      var text = messageInput.value;
      var title = titleInput.value;
      if (text && title) {
        newPostForCurrentUser(title, text).then(function() {
          myPostsMenuButton.click();
        });
        messageInput.value = "";
        titleInput.value = "";
      }
    };

    showSection(addPost);
    messageInput.value = "";
    titleInput.value = "";
  }
  init();

  /**
   * Saves a new post to the Firebase DB.
   */
  // [START write_fan_out]
  function writeNewPost(uid, username, picture, title, body) {
    // A post entry.
    var postData = {
      author: username,
      uid: uid,
      body: body,
      title: title,
      starCount: 0,
      authorPic: picture
    };

    // Get a key for a new Post.
    var newPostKey = firebase
      .database()
      .ref()
      .child("posts")
      .push().key;

    // Write the new post's data simultaneously in the posts list and the user's post list.
    var updates = {};
    updates["/posts/" + newPostKey] = postData;
    updates["/user-posts/" + uid + "/" + newPostKey] = postData;

    firebase
      .database()
      .ref()
      .update(updates);
    window.location.href = "#/";
    //return
  }
  // [END write_fan_out]

  /**
   * Creates a post element.
   */
  function createPostElement(postId, title, text, author, authorId, authorPic) {
    var uid = firebase.auth().currentUser.uid;

    var html =
      '<div class="post post-' +
      postId +
      " mdl-cell mdl-cell--12-col " +
      'mdl-cell--6-col-tablet mdl-cell--4-col-desktop mdl-grid mdl-grid--no-spacing">' +
      '<div class="mdl-card mdl-shadow--2dp">' +
      '<div class="mdl-card__title mdl-color--light-blue-600 mdl-color-text--white">' +
      '<h4 class="mdl-card__title-text"></h4>' +
      "</div>" +
      '<div class="header">' +
      "<div>" +
      '<div class="avatar"></div>' +
      '<div class="username mdl-color-text--black"></div>' +
      "</div>" +
      "</div>" +
      '<span class="star">' +
      '<div class="not-starred material-icons">star_border</div>' +
      '<div class="starred material-icons">star</div>' +
      '<div class="star-count">0</div>' +
      "</span>" +
      '<div class="text"></div>' +
      '<div class="comments-container"></div>' +
      '<form class="add-comment" action="#">' +
      '<div class="mdl-textfield mdl-js-textfield">' +
      '<input class="mdl-textfield__input new-comment" type="text">' +
      '<label class="mdl-textfield__label">Comment...</label>' +
      "</div>" +
      "</form>" +
      "</div>" +
      "</div>";

    // Create the DOM element from the HTML.
    var div = document.createElement("div");
    div.innerHTML = html;
    var postElement = div.firstChild;
    if (componentHandler) {
      componentHandler.upgradeElements(
        postElement.getElementsByClassName("mdl-textfield")[0]
      );
    }

    var addCommentForm = postElement.getElementsByClassName("add-comment")[0];
    var commentInput = postElement.getElementsByClassName("new-comment")[0];
    var star = postElement.getElementsByClassName("starred")[0];
    var unStar = postElement.getElementsByClassName("not-starred")[0];

    // Set values.
    postElement.getElementsByClassName("text")[0].innerText = text;
    postElement.getElementsByClassName(
      "mdl-card__title-text"
    )[0].innerText = title;
    postElement.getElementsByClassName("username")[0].innerText =
      author || "Anonymous";
    postElement.getElementsByClassName("avatar")[0].style.backgroundImage =
      'url("' + (authorPic || "./silhouette.jpg") + '")';

    // Listen for comments.
    // [START child_event_listener_recycler]
    var commentsRef = firebase.database().ref("post-comments/" + postId);
    commentsRef.on("child_added", function(data) {
      addCommentElement(
        postElement,
        data.key,
        data.val().text,
        data.val().author
      );
    });

    commentsRef.on("child_changed", function(data) {
      setCommentValues(
        postElement,
        data.key,
        data.val().text,
        data.val().author
      );
    });

    commentsRef.on("child_removed", function(data) {
      deleteComment(postElement, data.key);
    });
    // [END child_event_listener_recycler]

    // Listen for likes counts.
    // [START post_value_event_listener]
    var starCountRef = firebase
      .database()
      .ref("posts/" + postId + "/starCount");
    starCountRef.on("value", function(snapshot) {
      updateStarCount(postElement, snapshot.val());
    });
    // [END post_value_event_listener]

    // Listen for the starred status.
    var starredStatusRef = firebase
      .database()
      .ref("posts/" + postId + "/stars/" + uid);
    starredStatusRef.on("value", function(snapshot) {
      updateStarredByCurrentUser(postElement, snapshot.val());
    });

    // Keep track of all Firebase reference on which we are listening.
    listeningFirebaseRefs.push(commentsRef);
    listeningFirebaseRefs.push(starCountRef);
    listeningFirebaseRefs.push(starredStatusRef);

    // Create new comment.
    addCommentForm.onsubmit = function(e) {
      e.preventDefault();
      createNewComment(
        postId,
        firebase.auth().currentUser.displayName,
        uid,
        commentInput.value
      );
      commentInput.value = "";
      commentInput.parentElement.MaterialTextfield.boundUpdateClassesHandler();
    };

    // Bind starring action.
    var onStarClicked = function() {
      var globalPostRef = firebase.database().ref("/posts/" + postId);
      var userPostRef = firebase
        .database()
        .ref("/user-posts/" + authorId + "/" + postId);
      toggleStar(globalPostRef, uid);
      toggleStar(userPostRef, uid);
    };
    unStar.onclick = onStarClicked;
    star.onclick = onStarClicked;

    return postElement;
  }

  /**
   * Writes the user's data to the database.
   */
  // [START basic_write]
  function writeUserData(userId, name, email, imageUrl) {
    firebase
      .database()
      .ref("users/" + userId)
      .set({
        username: name,
        email: email,
        profile_picture: imageUrl
      });
  }
  // [END basic_write]

  /**
   * Cleanups the UI and removes all Firebase listeners.
   */
  function cleanupUi() {
    // Stop all currently listening Firebase listeners.
    listeningFirebaseRefs.forEach(function(ref) {
      ref.off();
    });
    listeningFirebaseRefs = [];
  }

  /**
   * The ID of the currently signed-in User. We keep track of this to detect Auth state change events that are just
   * programmatic token refresh but not a User status change.
   */
  var currentUID;

  /**
   * Triggers every time there is a change in the Firebase auth state (i.e. user signed-in or user signed out).
   */
  function onAuthStateChanged(user) {
    // We ignore token refresh events.
    if (user && currentUID === user.uid) {
      return;
    }

    cleanupUi();
    if (user) {
      currentUID = user.uid;
      writeUserData(user.uid, user.displayName, user.email, user.photoURL);
    } else {
      // Set currentUID to null.
      currentUID = null;
    }
  }

  /**
   * Creates a new post for the current user.
   */
  function newPostForCurrentUser(title, text) {
    // [START single_value_read]
    var userId = firebase.auth().currentUser.uid;
    return firebase
      .database()
      .ref("/users/" + userId)
      .once("value")
      .then(function(snapshot) {
        var username =
          (snapshot.val() && snapshot.val().username) || "Anonymous";
        // [START_EXCLUDE]
        return writeNewPost(
          firebase.auth().currentUser.uid,
          username,
          firebase.auth().currentUser.photoURL,
          title,
          text
        );
        // [END_EXCLUDE]
      });
    // [END single_value_read]
  }

  /**
   * Displays the given section element and changes styling of the given button.
   */
  function showSection(sectionElement, buttonElement) {
    addPost.style.display = "none";

    if (sectionElement) {
      sectionElement.style.display = "block";
    }
    if (buttonElement) {
      buttonElement.classList.add("is-active");
    }
  }
});
