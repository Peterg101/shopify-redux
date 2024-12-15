from setuptools import setup, find_packages

setup(
    name="jwt_auth",  # Name of your package
    version="0.1.0",  # Package version
    description="JWT authentication utilities for inter-service communication",
    long_description=open("README.md").read(),  # Load from README.md
    long_description_content_type="text/markdown",
    author="Peter Goon",  # Your name or organization
    author_email="pete.goon@googlemail.com",  # Contact email
    packages=find_packages(),  # Automatically find packages
    install_requires=[
        "PyJWT>=2.6.0",
        "fastapi>=0.95.2",
    ],  # Dependencies
    python_requires=">=3.7",  # Minimum Python version
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    entry_points={
        "console_scripts": [
            "jwt_auth=jwt_auth.jwt_auth:main",  # Optional: Expose CLI commands
        ]
    },
)
