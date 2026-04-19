    document.getElementById('login-button').addEventListener('click', function(event) {
            // Get the values of the input fields
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            let isValid = true;

            // Validate Username
            if (username === "") {
                document.getElementById('username-error').style.display = "block";
                isValid = false;
            } else {
                document.getElementById('username-error').style.display = "none";
            }

            // Validate Password
            if (password === "") {
                document.getElementById('password-error').style.display = "block";
                isValid = false;
            } else {
                document.getElementById('password-error').style.display = "none";
            }

            // If the form is not valid, prevent the form submission
            if (!isValid) {
                event.preventDefault();
            }
        });