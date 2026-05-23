import UIKit
import Capacitor
import WebKit

class ViewController: CAPBridgeViewController {

    override open func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)

        // Inject CSS that forces Hebrew-capable fonts in all input fields.
        // WKWebView's default font resolution can fail for Hebrew glyphs;
        // "Helvetica Neue" and "Arial Hebrew" are guaranteed to carry them on iOS.
        let hebrewFix = """
        (function() {
            var s = document.createElement('style');
            s.textContent =
                'input, textarea, [contenteditable] {' +
                '  font-family: "Helvetica Neue", "Arial Hebrew", -apple-system, sans-serif !important;' +
                '}';
            document.documentElement.appendChild(s);
        })();
        """

        let script = WKUserScript(
            source: hebrewFix,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: false
        )
        config.userContentController.addUserScript(script)

        return config
    }
}
