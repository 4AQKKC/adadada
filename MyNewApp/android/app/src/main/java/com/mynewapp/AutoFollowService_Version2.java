package com.ten_project_name;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

public class AutoFollowService extends AccessibilityService {
    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getPackageName() != null && event.getPackageName().toString().contains("tiktok")) {
            AccessibilityNodeInfo rootNode = getRootInActiveWindow();
            if (rootNode != null) {
                clickFollowNode(rootNode, "Follow");
                clickFollowNode(rootNode, "Theo dõi");
            }
        }
    }
    private void clickFollowNode(AccessibilityNodeInfo node, String text) {
        if (node == null) return;
        if (node.getText() != null && node.getText().toString().equalsIgnoreCase(text) && node.isClickable()) {
            node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            clickFollowNode(node.getChild(i), text);
        }
    }
    @Override
    public void onInterrupt() {}
}