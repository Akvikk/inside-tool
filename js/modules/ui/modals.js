(function () {
    let stopwatchInterval = null;
    let stopwatchSeconds = 0;

    function toggleClass(id, className = 'hidden') {
        const element = document.getElementById(id);
        if (element) {
            element.classList.toggle(className);
        }
        return element;
    }

    window.toggleHamburgerMenu = function () {
        toggleClass('hamburgerMenu');
        toggleClass('hamburgerBackdrop');
    };

    window.toggleAccordion = function (id) {
        const content = document.getElementById(id);
        const icon = document.getElementById(`${id}Icon`);
        if (!content) return;

        content.classList.toggle('hidden');
        if (icon) {
            icon.style.transform = content.classList.contains('hidden')
                ? 'rotate(0deg)'
                : 'rotate(180deg)';
        }
    };

    window.toggleModal = function (id) {
        return toggleClass(id);
    };

    window.togglePatternFilterPopover = function () {
        toggleClass('patternFilterPopover');
    };

    window.closePatternFilterPopover = function () {
        const popover = document.getElementById('patternFilterPopover');
        if (popover) {
            popover.classList.add('hidden');
        }
    };

    window.resetSession = function () {
        if (window.toggleModal) {
            window.toggleModal('confirmModal');
        }
    };

    window.toggleStopwatch = function () {
        const icon = document.getElementById('stopwatchIcon');
        const text = document.getElementById('stopwatchText');
        const display = document.getElementById('stopwatchDisplay');

        if (stopwatchInterval) {
            clearInterval(stopwatchInterval);
            stopwatchInterval = null;
            if (icon) {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
            }
            if (text) {
                text.innerText = 'Start';
            }
            return;
        }

        stopwatchInterval = setInterval(() => {
            stopwatchSeconds++;
            if (!display) return;

            const hours = Math.floor(stopwatchSeconds / 3600);
            const minutes = Math.floor((stopwatchSeconds % 3600) / 60);
            const seconds = stopwatchSeconds % 60;
            display.innerText = `${hours.toString().padStart(2, '0')}:${minutes
                .toString()
                .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);

        if (icon) {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
        }
        if (text) {
            text.innerText = 'Pause';
        }
    };

    window.resetStopwatch = function () {
        if (stopwatchInterval) {
            clearInterval(stopwatchInterval);
        }
        stopwatchInterval = null;
        stopwatchSeconds = 0;

        const display = document.getElementById('stopwatchDisplay');
        const icon = document.getElementById('stopwatchIcon');
        const text = document.getElementById('stopwatchText');

        if (display) {
            display.innerText = '00:00:00';
        }
        if (icon) {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        }
        if (text) {
            text.innerText = 'Start';
        }
    };
})();
