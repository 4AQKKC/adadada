package com.mynewapp // <-- sửa lại theo package app của bạn

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.soloader.SoLoader
import java.lang.reflect.InvocationTargetException

class MainApplication : Application(), ReactApplication {

    private val mReactNativeHost: ReactNativeHost = object : ReactNativeHost(this) {
        override fun getUseDeveloperSupport(): Boolean {
            return BuildConfig.DEBUG
        }

        override fun getPackages(): List<ReactPackage> {
            val packages = PackageList(this).packages
            // Nếu bạn có FloatingOverlayPackage tự viết, thêm dưới đây:
            // packages.add(FloatingOverlayPackage())
            return packages
        }

        override fun getJSMainModuleName(): String {
            return "index"
        }
    }

    override fun getReactNativeHost(): ReactNativeHost {
        return mReactNativeHost
    }

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, /* native exopackage */ false)
        if (BuildConfig.DEBUG) {
            try {
                val a = Class.forName("com.facebook.react.ReactNativeFlipper")
                a.getMethod("initializeFlipper", Application::class.java)
                    .invoke(null, this)
            } catch (e: ClassNotFoundException) {
            } catch (e: NoSuchMethodException) {
            } catch (e: IllegalAccessException) {
            } catch (e: InvocationTargetException) {
            }
        }
    }
}
