<?php
session_start();

if (isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
    unset($_SESSION['admin_logged_in']);
    unset($_SESSION['admin_user']);
}

header('Location: login.html');
exit;