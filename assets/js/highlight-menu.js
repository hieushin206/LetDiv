const currentPage = window.location.pathname;

document.querySelectorAll(".navbar-menu ul li a").forEach((link) => {
  if (link.pathname === currentPage) {
    link.parentElement.classList.add("active");
  }
});
