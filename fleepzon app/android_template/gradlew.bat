@ECHO OFF
@rem ##########################################################################
@rem
@rem  Gradle startup script for Windows
@rem
@rem ##########################################################################

@rem Set local scope for variables
IF "%OS%"=="Windows_NT" SETLOCAL

SET DIRNAME=%~dp0
IF "%DIRNAME%"=="" SET DIRNAME=.
SET APP_BASE_NAME=%~n0
SET APP_HOME=%DIRNAME%

@rem Add default JVM options here if desired
SET DEFAULT_JVM_OPTS=

@rem Find java.exe
IF DEFINED JAVA_HOME GOTO findJavaFromJavaHome

SET JAVA_EXE=java.exe
%JAVA_EXE% -version >NUL 2>&1
IF "%ERRORLEVEL%"=="0" GOTO init

ECHO.
ECHO ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.
ECHO Please set the JAVA_HOME variable in your environment to match the location of your Java installation.
ECHO.
EXIT /B 1

:findJavaFromJavaHome
SET JAVA_HOME=%JAVA_HOME:"=%
SET JAVA_EXE=%JAVA_HOME%\bin\java.exe

IF EXIST "%JAVA_EXE%" GOTO init

ECHO.
ECHO ERROR: JAVA_HOME is set to an invalid directory: %JAVA_HOME%
ECHO Please set the JAVA_HOME variable in your environment to match the location of your Java installation.
ECHO.
EXIT /B 1

:init
@rem Collect all arguments for Java command
SET CMD_LINE_ARGS=%*

@rem Locate Gradle wrapper jar
SET CLASSPATH=%APP_HOME%\gradle\wrapper\gradle-wrapper.jar

@rem Execute Gradle
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %CMD_LINE_ARGS%

:END
IF "%OS%"=="Windows_NT" ENDLOCAL
