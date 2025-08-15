package com.mynewapp // <-- đổi thành package thật của app bạn, trùng với AndroidManifest.xml

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.soloader.SoLoader
import java.lang.reflect.InvocationTargetException

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost = object : ReactNativeHost(this) {
        override fun getUseDeveloperSupport(): Boolean {
            return BuildConfig.DEBUG
        }

        override fun getPackages(): List<ReactPackage> {
            val packages = PackageList(this).packages
            // Nếu bạn có package tự viết thì add vào đây
            // packages.add(FloatingOverlayPackage())
            return packages
        }

        override fun getJSMainModuleName(): String {
            return "index"
        }
    }

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, /* native exopackage */ false)
        if (BuildConfig.DEBUG) {
            try {
                val a = Class.forName("com.facebook.react.ReactNativeFlipper")
                a.getMethod("initializeFlipper", Application::class.java)
                    .invoke(null, this)
            } catch (_: ClassNotFoundException) {
            } catch (_: NoSuchMethodException) {
            } catch (_: IllegalAccessException) {
            } catch (_: InvocationTargetException) {
            }
        }
    }
}
